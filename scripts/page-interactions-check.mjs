import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
await fs.mkdir('tmp/page-interactions',{recursive:true});
try {
 for (const reduced of [false,true]) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/quota',route=>route.fulfill({json:{isAnonymous:true,used:0,max:null,remaining:null,blocked:false}}));
  await page.goto('http://localhost:3001');
  const menu=page.getByRole('button',{name:'Open navigation'});await menu.click();
  assert.equal(await page.getByRole('button',{name:'Close navigation'}).getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');assert.equal(await menu.evaluate(el=>el===document.activeElement),true);
  await menu.click();await page.getByRole('link',{name:'Example stories'}).click();
  await page.getByRole('heading',{name:'Find a fresh way to tell your story.'}).waitFor();
  assert.equal(await page.locator('.sample-story').count(),4);
  await page.getByRole('button',{name:'Metaphor · iceberg',exact:true}).click();
  assert.equal(await page.locator('.sample-story').count(),1);
  await page.getByRole('status').filter({hasText:'1 example'}).waitFor();
  await page.getByRole('button',{name:'All examples',exact:true}).click();assert.equal(await page.locator('.sample-story').count(),4);
  if(reduced) {assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');assert.equal(await page.evaluate(()=>document.getAnimations().length),0);}
  await page.waitForTimeout(500);
  await page.screenshot({path:`tmp/page-interactions/samples-${reduced?'reduced':'animated'}.png`,fullPage:true});
  await page.goto('http://localhost:3001');
  const transfer=await page.evaluateHandle(()=>{const d=new DataTransfer();d.items.add(new File(['invalid'],'image.png',{type:'image/png'}));return d;});
  const form=page.locator('.interactive-source');await form.dispatchEvent('dragover',{dataTransfer:transfer});
  assert.equal(await form.evaluate(el=>el.classList.contains('is-dragging')),true);
  await form.dispatchEvent('drop',{dataTransfer:transfer});
  await page.getByRole('alert').filter({hasText:'Upload a PDF'}).waitFor();assert.equal(await form.evaluate(el=>el.classList.contains('is-dragging')),false);
  await transfer.dispose();
  await page.route('**/api/brand-kit',route=>route.fulfill({json:{anonymous:false,brandKit:null}}));
  await page.goto('http://localhost:3001/brand');await page.getByRole('heading',{name:'Brand kit',exact:true}).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({path:`tmp/page-interactions/brand-${reduced?'reduced':'animated'}.png`,fullPage:true});
  await page.goto('http://localhost:3001/auth/error?reason=test');await page.getByRole('heading',{name:'Sign-in didn’t complete.'}).waitFor();
  await page.goto('http://localhost:3001/does-not-exist');await page.getByRole('heading',{name:'This story isn’t here.'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log(`${reduced?'Reduced motion':'Standard motion'}: mobile menu, keyboard dismissal, sample filtering, file drop validation, brand page, and 404 passed.`);
  await context.close();
 }
}finally{await browser.close();}
