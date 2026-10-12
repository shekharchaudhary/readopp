import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await fs.mkdir('tmp/core-refresh', { recursive: true });
try {
  for (const [name, width, height] of [['desktop',1440,1100],['mobile',390,844]]) {
    const page = await browser.newPage({ viewport: {width,height} });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/quota', route => route.fulfill({ json: {isAnonymous:true,used:0,max:null,remaining:null,blocked:false} }));
    let submitted;
    await page.route('**/api/jobs', async route => {
      submitted = route.request().postDataJSON();
      await route.fulfill({status:503,json:{error:'Test service unavailable. Retry your source.'}});
    });
    await page.goto('http://localhost:3001');
    await page.getByRole('button',{name:/Google Docs/}).click();
    const input = page.getByRole('textbox',{name:'Shared Google Docs link'});
    await input.waitFor();
    await input.fill('https://docs.google.com/document/d/source-check');
    await page.getByRole('button',{name:'Create story →'}).click();
    await page.getByRole('alert').filter({hasText:'Test service unavailable'}).waitFor();
    assert.equal(submitted.url,'https://docs.google.com/document/d/source-check');
    assert.equal(await page.getByRole('button',{name:'Create story →'}).isEnabled(),true);
    await page.getByRole('button',{name:/Google Docs/}).click();
    await page.getByRole('textbox',{name:'Shared Google Docs link'}).fill('https://example.com/wrong');
    await page.getByRole('button',{name:'Create story →'}).click();
    await page.getByRole('alert').filter({hasText:'Paste a Google Docs'}).waitFor();
    await page.getByRole('button',{name:'Close document link form'}).click();
    await page.getByRole('textbox',{name:'Shared Google Docs link'}).waitFor({state:'hidden'});
    await page.screenshot({path:`tmp/core-refresh/${name}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log(`${name}: public link input, request payload, recoverable errors, provider validation, and no overflow passed.`);
    await page.close();
  }
} finally {await browser.close();}
