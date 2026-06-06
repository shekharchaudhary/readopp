import { createHash } from "node:crypto";
import type { Browser } from "playwright-core";
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

export interface RenderedPng {
  buffer: Buffer;
  filename: string;
  format: ExportFormat;
  width: number;
  height: number;
}

/**
 * Render HTML to a PNG buffer with no storage side-effect. Pure browser
 * work — useful for callers that render many panels back-to-back and want
 * to defer all uploads until after the browser is done (some serverless
 * runtimes suspend Chromium during long upload awaits).
 */
export async function renderHtmlToPng(input: {
  html: string;
  format: ExportFormat;
  cacheKeyParts: string[];
  browser?: Browser;
}): Promise<RenderedPng> {
  const dims = EXPORT_DIMENSIONS[input.format];
  const filename = `${input.format}-${hashKey(input.cacheKeyParts)}.png`;

  const browser = input.browser ?? (await getBrowser());
  const ctx = await browser.newContext({
    viewport: { width: dims.w, height: dims.h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  try {
    await page.setContent(input.html, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const buffer = Buffer.from(
      await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: dims.w, height: dims.h },
      })
    );
    return {
      buffer,
      filename,
      format: input.format,
      width: dims.w,
      height: dims.h,
    };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Render HTML to a PNG and persist it via the storage layer in one call.
 * Use this when you're only rendering a single panel; for multi-panel
 * exports, prefer renderHtmlToPng + a batched upload at the end.
 */
export async function htmlToPng(input: {
  html: string;
  format: ExportFormat;
  cacheKeyParts: string[];
  browser?: Browser;
}): Promise<ScreenshotResult> {
  const rendered = await renderHtmlToPng(input);
  const stored = await saveExportArtifact({
    buffer: rendered.buffer,
    filename: rendered.filename,
    contentType: "image/png",
  });
  return {
    url: stored.url,
    filePath: localFilePathFor(rendered.filename),
    buffer: rendered.buffer,
    format: rendered.format,
    width: rendered.width,
    height: rendered.height,
    cached: stored.cached,
  };
}
