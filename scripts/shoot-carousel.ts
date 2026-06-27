/**
 * Screenshot the three LinkedIn carousel styles from the Claude design
 * doc so we can see each panel before translating them into readopp
 * templates. Output: tmp/carousel-shots/{style}-{panel}.png
 *
 * Run: npx tsx scripts/shoot-carousel.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const FILE =
  "/Users/shekharchaudhary/Downloads/Readopp LinkedIn Carousel.html";
const OUT = join(process.cwd(), "tmp", "carousel-shots");
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  await page.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle" });

  const tracks = await page.locator(".ro-track").count();
  console.log(`found ${tracks} carousel track(s)`);

  for (let t = 0; t < tracks; t++) {
    const panels = await page
      .locator(".ro-track")
      .nth(t)
      .locator(":scope > *")
      .count();
    console.log(`track ${t}: ${panels} panels`);
    const viewport = page.locator(".ro-carousel").nth(t);
    for (let p = 0; p < panels; p++) {
      await page.evaluate(
        ([ti, pi]) => {
          const trk = document.querySelectorAll(".ro-track")[ti] as HTMLElement;
          trk.style.transition = "none";
          trk.style.transform = `translateX(-${pi * 100}%)`;
        },
        [t, p]
      );
      await page.waitForTimeout(80);
      await viewport.screenshot({
        path: join(OUT, `style${t + 1}-panel${String(p + 1).padStart(2, "0")}.png`),
      });
    }
  }
  await browser.close();
  console.log(`done -> ${OUT}`);
})();
