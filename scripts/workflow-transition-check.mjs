import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/quota', route => route.fulfill({ json: { isAnonymous: true, used: 0, max: null, remaining: null, blocked: false } }));
  await page.goto('http://localhost:3001/#how-it-works');
  await page.locator('.workflow-text-region').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.workflowNodes = [...document.querySelectorAll('.template-scene, .workflow-reveal-word')];
    window.workflowBoxes = [...document.querySelectorAll('.process-step')].map(el => {
      const { x, y, width, height } = el.getBoundingClientRect(); return { x, y, width, height };
    });
  });
  const first = page.getByRole('button', { name: /Add your source/ });
  const second = page.getByRole('button', { name: /Shape the story/ });
  const third = page.getByRole('button', { name: /Make it yours/ });
  await first.hover();
  await page.waitForTimeout(100);
  const opacity = await page.locator('.template-scene-stack > .template-scene').first().evaluate(el => Number(getComputedStyle(el).opacity));
  assert.ok(opacity > 0 && opacity < 1, `Expected a crossfade mid-transition, got ${opacity}`);
  for (const button of [second, third, first, second, first, third]) { await button.hover(); await page.waitForTimeout(45); }
  await page.waitForTimeout(500);
  assert.equal(await third.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.template-parallax').getAttribute('data-step'), '3');
  const stable = await page.evaluate(() => ({
    nodes: window.workflowNodes.every((node, i) => node === document.querySelectorAll('.template-scene, .workflow-reveal-word')[i]),
    boxes: [...document.querySelectorAll('.process-step')].every((el, i) => {
      const box = el.getBoundingClientRect(); return ['x','y','width','height'].every(key => Math.abs(box[key] - window.workflowBoxes[i][key]) < .5);
    }),
    visible: [...document.querySelectorAll('.template-scene-stack > .template-scene')].map(el => Number(getComputedStyle(el).opacity)),
  }));
  assert.ok(stable.nodes, 'Hover must preserve scene and text nodes');
  assert.ok(stable.boxes, 'Hover must preserve row position and dimensions');
  assert.deepEqual(stable.visible, [0, 0, 1]);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await second.hover();
  await page.waitForTimeout(500);
  assert.equal(await second.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'tmp/workflow-effects/smooth-dark.png' });
  console.log('Smooth crossfade, stable rows, persistent nodes, rapid hover reversal, and dark theme passed.');
} finally { await browser.close(); }
