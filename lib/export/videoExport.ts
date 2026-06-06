import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPkg from "@ffmpeg-installer/ffmpeg";
import { getBrowser } from "../playwright";
import { findExportArtifact, saveExportArtifact } from "./storage";
import { VIDEO_DIMENSIONS, type VideoFormat } from "./buildVideoHtml";

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

const RECORD_TAIL_MS = 500;
const OUTPUT_FPS = 30;

export interface VideoResult {
  url: string;
  format: VideoFormat;
  width: number;
  height: number;
  durationMs: number;
  cached: boolean;
}

interface RenderInput {
  html: string;
  format: VideoFormat;
  durationMs: number;
  cacheKeyParts: string[];
}

/**
 * Render an animated HTML doc to an MP4.
 *
 * We capture frames via Chromium's DevTools Protocol screencast (Page.start
 * Screencast) and pipe them straight into ffmpeg's stdin. This avoids two
 * problems with Playwright's recordVideo path:
 *
 *   1. recordVideo needs Playwright's own bundled ffmpeg binary, which isn't
 *      shipped to the Vercel function bundle. CDP works on any Chromium.
 *   2. The webm → mp4 transcode round-trip required holding the entire raw
 *      recording on disk; streaming PNGs is leaner and skips an intermediate
 *      format.
 *
 * Idempotent on cacheKeyParts — same parts return the cached artifact URL.
 */
export async function htmlToMp4(input: RenderInput): Promise<VideoResult> {
  const dims = VIDEO_DIMENSIONS[input.format];
  const cacheHash = hashKey([
    ...input.cacheKeyParts,
    String(input.durationMs),
    `${dims.w}x${dims.h}`,
  ]);
  const filename = `video-${input.format}-${cacheHash}.mp4`;

  const cachedUrl = await findExportArtifact(filename);
  if (cachedUrl) {
    return {
      url: cachedUrl,
      format: input.format,
      width: dims.w,
      height: dims.h,
      durationMs: input.durationMs,
      cached: true,
    };
  }

  const workDir = await mkdtemp(join(tmpdir(), "readopp-vid-"));
  const mp4Path = join(workDir, filename);

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: dims.w, height: dims.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  try {
    const ffmpeg = spawnFfmpeg(mp4Path);
    const stdin = ffmpeg.proc.stdin!;
    const cdp = await ctx.newCDPSession(page);

    // Backpressure-aware writer. If ffmpeg can't keep up, await drain so we
    // don't blow stdin's high-water mark.
    let writePending: Promise<void> = Promise.resolve();
    const writeFrame = (buf: Buffer) => {
      writePending = writePending.then(
        () =>
          new Promise<void>((resolve) => {
            const ok = stdin.write(buf);
            if (ok) resolve();
            else stdin.once("drain", () => resolve());
          })
      );
    };

    cdp.on("Page.screencastFrame", (frame) => {
      const buf = Buffer.from(frame.data, "base64");
      writeFrame(buf);
      cdp
        .send("Page.screencastFrameAck", { sessionId: frame.sessionId })
        .catch(() => {});
    });

    // Start screencast first so we capture the page setup as the
    // animations begin. Chromium emits a frame for each layout repaint.
    await cdp.send("Page.startScreencast", {
      format: "png",
      everyNthFrame: 1,
    });

    await page.setContent(input.html, { waitUntil: "load" });
    await page.waitForTimeout(input.durationMs + RECORD_TAIL_MS);

    await cdp.send("Page.stopScreencast").catch(() => {});
    await cdp.detach().catch(() => {});

    // Flush all queued writes before closing stdin, otherwise ffmpeg may
    // truncate the tail of the video.
    await writePending;
    stdin.end();
    await ffmpeg.done;

    const buffer = await readFile(mp4Path);
    const stored = await saveExportArtifact({
      buffer,
      filename,
      contentType: "video/mp4",
    });

    return {
      url: stored.url,
      format: input.format,
      width: dims.w,
      height: dims.h,
      durationMs: input.durationMs,
      cached: stored.cached,
    };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Spawn ffmpeg consuming PNG frames from stdin → MP4 at outputPath.
 * Returns a handle so the caller can write frames + await completion.
 */
function spawnFfmpeg(outputPath: string): {
  proc: ReturnType<typeof spawn>;
  done: Promise<void>;
} {
  const args = [
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(OUTPUT_FPS),
    "-i",
    "-",
    "-an",
    "-vf",
    // Force even pixel dimensions and yuv420p — both required for x264 +
    // every consumer player.
    "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    "-r",
    String(OUTPUT_FPS),
    outputPath,
  ];

  const proc = spawn(ffmpegPkg.path, args, {
    stdio: ["pipe", "ignore", "pipe"],
  });
  let stderr = "";
  proc.stderr!.on("data", (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
  });
  // Don't let an unhandled stdin EPIPE crash the function if ffmpeg dies
  // first; we surface the real error via the proc close handler.
  proc.stdin!.on("error", () => {});

  const done = new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`)
        );
    });
  });

  return { proc, done };
}
