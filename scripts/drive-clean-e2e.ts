/**
 * Drive the Clean style end-to-end through a real browser:
 * home → pick Clean → submit an article → job page renders panels.
 * Captures screenshots into tmp/e2e-clean/.
 *
 * Run: npx tsx scripts/drive-clean-e2e.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3001";
const ARTICLE = process.env.ARTICLE ?? "https://en.wikipedia.org/wiki/Spaced_repetition";
const OUT = join(process.cwd(), "tmp", "e2e-clean");
mkdirSync(OUT, { recursive: true });

const shot = (page: import("playwright").Page, name: string) =>
  page.screenshot({ path: join(OUT, name), fullPage: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } } as never);
  page.on("console", (m) => console.log("  [console]", m.type(), m.text()));

  console.log("→ loading home", BASE);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "01-home.png");

  console.log("→ selecting Clean style");
  await page.getByRole("button", { name: "Clean" }).click();
  await page.waitForTimeout(150);
  await shot(page, "02-clean-selected.png");

  console.log("→ filling URL + submit:", ARTICLE);
  await page.locator("#url").fill(ARTICLE);
  const submit = page.getByRole("button", { name: /^Explain$/ });
  await submit.click();

  console.log("→ waiting for /j/ navigation");
  await page.waitForURL(/\/j\//, { timeout: 60_000 });
  console.log("   job page:", page.url());
  await shot(page, "03-job-loading.png");

  console.log("→ waiting for first rendered SVG panel (up to 5 min)");
  await page.locator("svg").first().waitFor({ state: "attached", timeout: 300_000 });

  // Let the stream fill in, then count panels.
  let lastCount = 0;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(4000);
    const n = await page.locator("svg").count();
    console.log(`   svg count: ${n}`);
    if (n === lastCount && n > 0) break;
    lastCount = n;
  }
  await shot(page, "04-job-rendered.png");
  console.log("✓ done — screenshots in", OUT);
  await browser.close();
}

main().catch((e) => {
  console.error("E2E failed:", e);
  process.exit(1);
});
