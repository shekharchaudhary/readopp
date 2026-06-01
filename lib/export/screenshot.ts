import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getBrowser } from "../playwright";
import { EXPORT_DIMENSIONS, type ExportFormat } from "./dimensions";

export const EXPORTS_DIR = join(process.cwd(), ".readopp-exports");

/** Public URL prefix the dev server uses to serve PNGs. */
export const EXPORTS_PUBLIC_PREFIX = "/api/exports";

async function ensureExportsDir(): Promise<void> {
  if (!existsSync(EXPORTS_DIR)) await mkdir(EXPORTS_DIR, { recursive: true });
}

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

export interface ScreenshotResult {
  url: string;
  filePath: string;
  format: ExportFormat;
  width: number;
  height: number;
  cached: boolean;
}

/**
 * Render an HTML document at exact dimensions and screenshot it to a PNG on
 * disk. Returns the served URL. Idempotent: same cacheKeyParts -> same PNG file.
 */
export async function htmlToPng(input: {
  html: string;
  format: ExportFormat;
  cacheKeyParts: string[];
}): Promise<ScreenshotResult> {
  await ensureExportsDir();
  const dims = EXPORT_DIMENSIONS[input.format];
  const filename = `${input.format}-${hashKey(input.cacheKeyParts)}.png`;
  const filePath = join(EXPORTS_DIR, filename);
  const url = `${EXPORTS_PUBLIC_PREFIX}/${filename}`;

  if (existsSync(filePath)) {
    return {
      url,
      filePath,
      format: input.format,
      width: dims.w,
      height: dims.h,
      cached: true,
    };
  }

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: dims.w, height: dims.h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  try {
    await page.setContent(input.html, { waitUntil: "load" });
    // Give web fonts / layout one frame to settle.
    await page.waitForLoadState("networkidle").catch(() => {});
    const buf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: dims.w, height: dims.h },
    });
    await writeFile(filePath, buf);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }

  return {
    url,
    filePath,
    format: input.format,
    width: dims.w,
    height: dims.h,
    cached: false,
  };
}
