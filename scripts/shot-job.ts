/**
 * Screenshot a finished job page's rendered panels.
 * Run: JID=<jobId> npx tsx scripts/shot-job.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3001";
const JID = process.env.JID;
if (!JID) throw new Error("set JID env");
const OUT = join(process.cwd(), "tmp", "e2e-clean");
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 1400 } } as never);
  await page.goto(`${BASE}/j/${JID}`, { waitUntil: "networkidle" });
  await page.locator("svg").first().waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(1500);
  const svgs = await page.locator("svg").count();
  console.log("svg count on page:", svgs);
  await page.screenshot({ path: join(OUT, "05-clean-final.png"), fullPage: true });
  console.log("saved 05-clean-final.png");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
