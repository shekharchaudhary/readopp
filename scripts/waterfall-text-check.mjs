import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
await fs.mkdir('tmp/waterfall-text', { recursive: true });
try {
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1440, height: 1000 } }],
    ['reduced', { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }],
    ['touch', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ]) {
    const page = await browser.newPage(options);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/quota', route => route.fulfill({ json: { isAnonymous: true, used: 0, max: null, remaining: null, blocked: false } }));
    await page.goto('http://localhost:3001');
    const paragraph = page.locator('[data-pretext-waterfall="ready"]');
    await paragraph.waitFor();
    await page.waitForTimeout(1000);
    const word = paragraph.locator('[data-waterfall-word]').filter({ hasText: 'documents' });
    const height = (await paragraph.boundingBox()).height;
    await word.hover();
    await page.waitForTimeout(130);
    const motion = await word.evaluate(el => [...el.children].map(glyph => ({ animations: glyph.getAnimations().length, transform: getComputedStyle(glyph).transform })));
    if (name === 'desktop') {
      assert.ok(motion.every(glyph => glyph.animations === 1));
      assert.ok(motion.some(glyph => glyph.transform !== 'none'));
      assert.equal(await paragraph.locator('[data-waterfall-word]').first().evaluate(el => el.getAnimations({ subtree: true }).length), 0);
      assert.equal((await paragraph.boundingBox()).height, height);
      await page.screenshot({ path: `tmp/waterfall-text/${name}-hover.png` });
      await page.waitForTimeout(1000);
      assert.equal(await word.evaluate(el => el.getAnimations({ subtree: true }).length), 0);
      assert.ok(await word.evaluate(el => [...el.children].every(glyph => getComputedStyle(glyph).transform === 'none' && getComputedStyle(glyph).opacity === '1')));
      await page.mouse.move(0, 0);
      await word.hover();
      await page.mouse.move(0, 0);
      assert.equal(await word.evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    } else {
      assert.ok(motion.every(glyph => glyph.animations === 0));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `tmp/waterfall-text/${name}-rest.png` });
    console.log(`${name}: word hover, stable layout, clean reset, and motion preferences passed.`);
    await page.close();
  }
} finally { await browser.close(); }
