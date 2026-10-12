/** Browser check of the real picker with controlled save outcomes; no database. */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { PanelLayoutPicker } from './components/PanelLayoutPicker';
      const panel = {
        sectionId: 'recovery-check', heading: 'Protect focused work',
        caption: 'A clear story', format: 'svg', content: '<svg/>',
        plan: { visualType: 'structural', nodes: [
          { id: 'focus', label: 'Focus' }, { id: 'share', label: 'Share' }
        ], edges: [], framework: { title: 'Focus', steps: [
          { label: 'Focus', description: 'Protect time' },
          { label: 'Share', description: 'Share progress' }
        ] } }
      };
      function Fixture() {
        const [custom, setCustom] = useState(true);
        const [layout, setLayout] = useState('auto');
        return <PanelLayoutPicker explainerId="local-check"
          panel={{ ...panel, layoutVariant: layout }} index={1}
          template="adaptive-editorial" currentIsCustom={custom}
          onChange={async (value) => { setLayout(value); setCustom(false); }}
          onRestoreCustom={() => new Promise((resolve, reject) => {
            window.rejectRestore = () => reject(new Error('Restore failed. Try Undo again.'));
            window.finishRestore = () => { setCustom(true); resolve(); };
          })}
        />;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);
    `,
  },
  bundle: true,
  write: false,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  tsconfig: "tsconfig.json",
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.route("**/api/**", (route) => route.fulfill({
    contentType: "text/html", body: "<html><body>Layout preview</body></html>",
  }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const trigger = page.getByRole("button", { name: /^Change panel layout/ });
  await trigger.click();
  const sheet = page.getByTestId("layout-picker-sheet");
  await sheet.locator("button[data-layout-id]:not([disabled])").first().click();
  await page.getByTestId("layout-replace-confirmation")
    .getByRole("button", { name: /^Use / }).click();
  await sheet.waitFor({ state: "hidden" });

  const status = page.getByTestId("layout-applied-status");
  await status.getByRole("button", { name: "Undo", exact: true }).click();
  await page.clock.fastForward(8000);
  assert(await status.isVisible(), "Undo disappeared during a slow restore");
  assert(await trigger.isDisabled(), "layout changes remained enabled during restore");
  assert(await status.getByRole("button", { name: "Restoring…" }).isDisabled());

  await page.evaluate(() => window.rejectRestore());
  const alert = page.getByRole("alert");
  await alert.waitFor({ state: "visible" });
  assert.match(await alert.innerText(), /Restore failed/);
  assert.equal(await sheet.count(), 0, "failure unexpectedly reopened the picker");
  await page.clock.fastForward(8000);
  assert(await status.isVisible(), "failed restore lost the retry action");
  assert(await trigger.isEnabled());

  await status.getByRole("button", { name: "Undo", exact: true }).click();
  await page.evaluate(() => window.finishRestore());
  await status.waitFor({ state: "hidden" });
  await alert.waitFor({ state: "hidden" });
  assert.match(await trigger.innerText(), /Canvas custom/);
  await page.waitForFunction(() =>
    document.activeElement?.getAttribute("aria-label")?.startsWith("Change panel layout")
  );
  assert.deepEqual(errors, [], "browser errors");
  console.log("✓ layout undo: slow restore, visible failure, retained retry, successful recovery, focus restoration");
} finally {
  await browser.close();
}
