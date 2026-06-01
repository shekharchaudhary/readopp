import type { Browser } from "playwright";

/**
 * Process-wide singleton headless Chromium. Shared across ingest (JS-render
 * fallback), PNG screenshot export, and MP4 video export so we don't pay the
 * memory cost of launching three Chromiums when the dev server hot-reloads.
 *
 * Cached on globalThis so Next.js's module-graph rebuilds in development
 * don't leak browsers either.
 */

declare global {
  // eslint-disable-next-line no-var
  var __readopp_browser__: Promise<Browser> | undefined;
}

export async function getBrowser(): Promise<Browser> {
  if (!globalThis.__readopp_browser__) {
    globalThis.__readopp_browser__ = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({ headless: true });
    })();
  }
  return globalThis.__readopp_browser__;
}
