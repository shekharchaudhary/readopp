import { createHash } from "node:crypto";
import { getBrowser } from "../playwright";
import { EXPORT_DIMENSIONS, type ExportFormat } from "./dimensions";
import {
  EXPORTS_DIR,
  EXPORTS_PUBLIC_PREFIX,
  localFilePathFor,
  saveExportArtifact,
} from "./storage";

// Re-export so existing imports keep working (e.g. the legacy /api/exports
// proxy route reads EXPORTS_DIR to serve local files).
export { EXPORTS_DIR, EXPORTS_PUBLIC_PREFIX };

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

export interface ScreenshotResult {
  url: string;
  /** Local file path when running on disk; null on the blob backend. */
  filePath: string | null;
  /** Raw PNG buffer — exposed so downstream callers (e.g. ZIP bundler)
   *  don't need to round-trip through storage. */
  buffer: Buffer;
  format: ExportFormat;
  width: number;
  height: number;
  cached: boolean;
}

/**
 * Render an HTML document at exact dimensions and screenshot it to a PNG.
 * Persists via the storage layer (disk in dev, Vercel Blob in production).
 * Idempotent: same cacheKeyParts → same filename → same URL.
 */
export async function htmlToPng(input: {
  html: string;
  format: ExportFormat;
  cacheKeyParts: string[];
}): Promise<ScreenshotResult> {
  const dims = EXPORT_DIMENSIONS[input.format];
  const filename = `${input.format}-${hashKey(input.cacheKeyParts)}.png`;

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: dims.w, height: dims.h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  let buffer: Buffer;
  try {
    await page.setContent(input.html, { waitUntil: "load" });
    // Give web fonts / layout one frame to settle.
    await page.waitForLoadState("networkidle").catch(() => {});
    buffer = Buffer.from(
      await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: dims.w, height: dims.h },
      })
    );
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }

  const stored = await saveExportArtifact({
    buffer,
    filename,
    contentType: "image/png",
  });

  return {
    url: stored.url,
    filePath: localFilePathFor(filename),
    buffer,
    format: input.format,
    width: dims.w,
    height: dims.h,
    cached: stored.cached,
  };
}
