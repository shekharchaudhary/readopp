import type { Browser } from "playwright-core";

/**
 * Process-wide singleton headless Chromium. Two paths:
 *
 *  - Local dev (and any node host with a writable filesystem): uses the
 *    full `playwright` package, which bundles its own Chromium download.
 *
 *  - Vercel serverless (detected via process.env.VERCEL): uses
 *    `playwright-core` + `@sparticuz/chromium`. The latter ships a
 *    Lambda/Vercel-tuned Chromium build that fits within the function
 *    size limits and starts fast in /tmp.
 *
 * The Browser type is sourced from playwright-core (a subset of playwright)
 * so callers get the same surface in both environments.
 */

declare global {
  // eslint-disable-next-line no-var
  var __readopp_browser__: Promise<Browser> | undefined;
}

const IS_VERCEL = Boolean(process.env.VERCEL);

async function launchBrowser(): Promise<Browser> {
  if (IS_VERCEL) {
    // Serverless Chromium tuned for Vercel / AWS Lambda. The dynamic imports
    // keep playwright (the full SDK) out of the prod bundle entirely.
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: pwChromium } = await import("playwright-core");
    const executablePath = await chromium.executablePath();
    return pwChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

export async function getBrowser(): Promise<Browser> {
  // The cached browser process can die between warm invocations on Lambda
  // (sandbox recycling), even though the globalThis handle survives. Verify
  // it's still connected; if not, relaunch.
  if (globalThis.__readopp_browser__) {
    try {
      const browser = await globalThis.__readopp_browser__;
      if (browser.isConnected()) return browser;
    } catch {
      // Fall through to relaunch.
    }
  }
  globalThis.__readopp_browser__ = launchBrowser();
  return globalThis.__readopp_browser__;
}
