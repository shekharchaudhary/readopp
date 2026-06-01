import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright";
import ffmpegPkg from "@ffmpeg-installer/ffmpeg";
import { EXPORTS_DIR, EXPORTS_PUBLIC_PREFIX } from "./screenshot";
import { VIDEO_DIMENSIONS, type VideoFormat } from "./buildVideoHtml";

// Reuse a single headless Chromium across requests.
let _browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!_browserPromise) {
    _browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({ headless: true });
    })();
  }
  return _browserPromise;
}

async function ensureExportsDir(): Promise<void> {
  if (!existsSync(EXPORTS_DIR)) await mkdir(EXPORTS_DIR, { recursive: true });
}

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

const RECORD_TAIL_MS = 500; // hold a beat after animations finish

export interface VideoResult {
  url: string;
  filePath: string;
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
 * Render an animated HTML doc to an MP4. Reuses Playwright + bundled ffmpeg.
 * Idempotent on cacheKeyParts — same parts return the same file.
 */
export async function htmlToMp4(input: RenderInput): Promise<VideoResult> {
  await ensureExportsDir();
  const dims = VIDEO_DIMENSIONS[input.format];
  const cacheHash = hashKey([
    ...input.cacheKeyParts,
    String(input.durationMs),
    `${dims.w}x${dims.h}`,
  ]);
  const filename = `video-${input.format}-${cacheHash}.mp4`;
  const filePath = join(EXPORTS_DIR, filename);
  const url = `${EXPORTS_PUBLIC_PREFIX}/${filename}`;

  if (existsSync(filePath)) {
    return {
      url,
      filePath,
      format: input.format,
      width: dims.w,
      height: dims.h,
      durationMs: input.durationMs,
      cached: true,
    };
  }

  const webmDir = await mkdtemp(join(tmpdir(), "readopp-vid-"));
  let webmPath: string | null = null;

  try {
    const browser = await getBrowser();
    const ctx = await browser.newContext({
      viewport: { width: dims.w, height: dims.h },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: webmDir,
        size: { width: dims.w, height: dims.h },
      },
    });
    const page = await ctx.newPage();
    try {
      await page.setContent(input.html, { waitUntil: "load" });
      // Wait the animation duration plus a small tail so the outro fully renders.
      await page.waitForTimeout(input.durationMs + RECORD_TAIL_MS);
      const video = page.video();
      // Path can only be read once context is closing. Stash now.
      webmPath = video ? await video.path() : null;
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }

    if (!webmPath) {
      // Playwright wasn't asked to record (shouldn't happen) — fall back to
      // scanning the temp dir.
      const files = await readdir(webmDir);
      const webm = files.find((f) => f.endsWith(".webm"));
      if (!webm) {
        throw new Error("Playwright didn't produce a video file.");
      }
      webmPath = join(webmDir, webm);
    }

    await transcodeWebmToMp4(webmPath, filePath);
  } finally {
    // Best-effort cleanup of the temp webm dir.
    await rm(webmDir, { recursive: true, force: true }).catch(() => {});
  }

  return {
    url,
    filePath,
    format: input.format,
    width: dims.w,
    height: dims.h,
    durationMs: input.durationMs,
    cached: false,
  };
}

/**
 * Convert webm → mp4 (H.264 + AAC-silent) with stream-friendly +faststart.
 * No audio track; we pass `-an` so the result has no audio stream rather
 * than a dummy silent one.
 */
function transcodeWebmToMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-an",
      "-vf",
      // yuv420p forces an even-pixel-friendly pixel format that all players accept.
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
      "30",
      outputPath,
    ];

    const child = spawn(ffmpegPkg.path, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // Cap stderr so a noisy ffmpeg can't blow memory.
      if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
    });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
