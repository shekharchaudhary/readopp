/**
 * Disposable desktop product-flow check:
 * generated panels → suggested layout → native canvas text edit/addition
 * → adjacent-panel navigation → exact-panel return → identity switch.
 *
 * The fixture is isolated to the browser's anonymous user and is deleted in
 * `finally`. No model request is made and existing library rows are never
 * queried or changed.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-desktop-editor");
const FIXTURE_TITLE = "Designing calmer collaboration";

mkdirSync(OUT, { recursive: true });

let jobId = null;
let explainerId = null;
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: join(OUT, name), fullPage });
}

async function cleanup() {
  if (!jobId && !explainerId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("cleanup skipped: Supabase admin environment is unavailable");
    return;
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (explainerId) {
    const { data } = await admin
      .from("explainers")
      .select("id,job_id,title")
      .eq("id", explainerId)
      .maybeSingle();
    assert(
      !data || (data.job_id === jobId && data.title === FIXTURE_TITLE),
      `refusing cleanup: explainer ${explainerId} did not match this fixture`
    );
    if (data) {
      const { error } = await admin.from("explainers").delete().eq("id", explainerId);
      if (error) throw error;
    }
  }

  if (jobId) {
    const { data } = await admin
      .from("jobs")
      .select("id,url")
      .eq("id", jobId)
      .maybeSingle();
    assert(
      !data || data.url === "fixture://mobile-editor",
      `refusing cleanup: job ${jobId} did not match this fixture`
    );
    if (data) {
      const { error } = await admin.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
    }
  }
}

async function openTextEditor(page, canvas, candidates) {
  const box = await canvas.boundingBox();
  assert(box, "canvas has no measurable box");
  const editor = page.locator("textarea:visible");
  for (const [xRatio, yRatio] of candidates) {
    await page.mouse.dblclick(
      box.x + box.width * xRatio,
      box.y + box.height * yRatio,
      { delay: 70 }
    );
    if (await editor.isVisible().catch(() => false)) {
      if ((await editor.inputValue()).trim()) return editor;
      await page.keyboard.press("Escape");
      await editor.waitFor({ state: "hidden" }).catch(() => {});
      continue;
    }
    await page.keyboard.press("Escape");
  }
  return null;
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  console.log("→ create isolated desktop fixture");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const fixtureResponse = await page.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    { headers: { "x-readopp-e2e": "mobile-editor-flow-v1" } }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture creation failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  explainerId = fixture.explainerId;
  assert(jobId && explainerId, "fixture did not return job and explainer ids");

  await page.goto(`${BASE}/e/${explainerId}`, { waitUntil: "domcontentloaded" });
  const firstPanel = page.locator('[data-testid^="panel-card-"]').first();
  await firstPanel.waitFor({ state: "visible", timeout: 60_000 });
  const panelTestId = await firstPanel.getAttribute("data-testid");
  const sectionId = panelTestId?.replace("panel-card-", "");
  assert(sectionId, "first panel section id missing");
  const layoutTrigger = firstPanel.locator('button[aria-controls^="panel-layout-picker-"]');
  await layoutTrigger.click({ trial: true });
  const [templateTriggerBox, editFirstBox, exportStoryBox] = await Promise.all([
    page.locator('button[aria-controls="template-picker-dialog"]').boundingBox(),
    page.getByRole("link", { name: "Customize first panel", exact: true }).boundingBox(),
    page.getByRole("button", { name: "Export story", exact: true }).boundingBox(),
  ]);
  assert(
    templateTriggerBox && editFirstBox && exportStoryBox,
    "story-level creation actions are not all visible"
  );
  assert(
    Math.max(templateTriggerBox.y, editFirstBox.y, exportStoryBox.y) -
      Math.min(templateTriggerBox.y, editFirstBox.y, exportStoryBox.y) <
      4,
    "desktop story-level creation actions wrapped into competing rows"
  );
  await shot(page, "01-story.png");

  console.log("→ guide a focused panel regeneration");
  const regenerateTrigger = firstPanel.getByRole("button", {
    name: "Regenerate",
    exact: true,
  });
  await regenerateTrigger.focus();
  await regenerateTrigger.press("Enter");
  const regenerateDialog = page.getByTestId("panel-regenerate-dialog");
  const regenerateInput = regenerateDialog.getByLabel("Direction for this panel");
  await regenerateDialog.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === null && document.activeElement?.tagName === "TEXTAREA",
    undefined,
    { timeout: 5_000 }
  );
  assert(
    (await regenerateDialog.textContent())?.includes(await firstPanel.locator("h2").innerText()),
    "regeneration dialog did not identify the selected panel"
  );
  await page.keyboard.press("Escape");
  await regenerateDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-controls")?.startsWith("regenerate-panel-") === true,
    undefined,
    { timeout: 5_000 }
  );
  assert(
    await regenerateTrigger.evaluate((element) => element === document.activeElement),
    "regeneration dialog Escape did not restore trigger focus"
  );

  await regenerateTrigger.click();
  await regenerateDialog
    .getByRole("button", { name: "Lead with the strongest evidence" })
    .click();
  assert(
    (await regenerateInput.inputValue()) === "Lead with the strongest evidence",
    "regeneration preset did not become editable guidance"
  );
  const resetPattern = `**/api/explainers/${explainerId}/panels/${sectionId}/reset`;
  await page.route(resetPattern, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Regeneration temporarily unavailable." }),
    });
  });
  const consoleErrorsBeforeRegenerationFailure = consoleErrors.length;
  await regenerateDialog.getByRole("button", { name: "Regenerate panel" }).click();
  await regenerateDialog.getByRole("alert").getByText("Regeneration temporarily unavailable.").waitFor();
  const expectedRegenerationConsoleErrors = consoleErrors.slice(
    consoleErrorsBeforeRegenerationFailure
  );
  assert(
    expectedRegenerationConsoleErrors.every((message) => message.includes("status of 503")),
    `unexpected browser error during the simulated regeneration failure:\n${expectedRegenerationConsoleErrors.join("\n")}`
  );
  consoleErrors.splice(consoleErrorsBeforeRegenerationFailure);
  assert(
    (await regenerateInput.inputValue()) === "Lead with the strongest evidence",
    "failed regeneration discarded the user's guidance"
  );
  await regenerateDialog.getByRole("button", { name: "Regenerate panel" }).focus();
  await page.keyboard.press("Tab");
  assert(
    await regenerateDialog.evaluate((element) => element.contains(document.activeElement)),
    "regeneration dialog allowed keyboard focus to escape"
  );
  await page.keyboard.press("Escape");
  await regenerateDialog.waitFor({ state: "hidden" });
  await page.unroute(resetPattern);

  console.log("→ manage panels without losing the selected slide");
  const initialPanelCount = await page.locator('[data-testid^="panel-card-"]').count();
  const firstMore = firstPanel.getByRole("button", { name: "More panel actions" });
  await firstMore.focus();
  await firstMore.press("Enter");
  const firstMenu = page.getByRole("menu", { name: `Actions for ${await firstPanel.locator("h2").innerText()}` });
  await firstMenu.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("role") === "menuitem",
    undefined,
    { timeout: 5_000 }
  );
  assert(
    (await page.locator(":focus").textContent())?.includes("Change panel colors"),
    "panel menu did not focus its first action"
  );
  await page.keyboard.press("ArrowDown");
  assert(
    (await page.locator(":focus").textContent())?.includes("Export this panel"),
    "panel menu ArrowDown did not advance focus"
  );
  await page.keyboard.press("End");
  assert(
    (await page.locator(":focus").textContent())?.includes("Delete panel"),
    "panel menu End did not reach the final action"
  );
  await page.keyboard.press("Escape");
  await firstMenu.waitFor({ state: "hidden" });
  await page.waitForFunction(
    (id) =>
      document.activeElement?.getAttribute("aria-label") === "More panel actions" &&
      document.activeElement
        ?.closest('[data-testid^="panel-card-"]')
        ?.getAttribute("data-testid") === `panel-card-${id}`,
    sectionId,
    { timeout: 5_000 }
  );

  const addAtStart = page.getByRole("button", { name: "Add panel above" });
  const startInsertResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/insert`)
  );
  await addAtStart.click();
  const startInsertedResponse = await startInsertResponse;
  assert(startInsertedResponse.ok(), "top panel insertion failed");
  const startInsertedPayload = await startInsertedResponse.json();
  const startInsertedId = startInsertedPayload.sectionId;
  assert(startInsertedId, "top panel insertion omitted the new section id");
  await page.waitForURL(
    new RegExp(`/edit/${explainerId}/${startInsertedId}$`),
    { timeout: 60_000 }
  );
  await page
    .getByTestId("canvas-action-strip")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.waitForURL(
    new RegExp(`/e/${explainerId}#panel-${startInsertedId}$`),
    { timeout: 60_000 }
  );
  const startInsertedPanel = page.getByTestId(`panel-card-${startInsertedId}`);
  await startInsertedPanel.waitFor({ state: "visible" });
  const orderAfterStartInsert = await page
    .locator('[data-testid^="panel-card-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
  assert(
    orderAfterStartInsert[0] === `panel-card-${startInsertedId}`,
    "the top insertion slot did not add the panel above the first panel"
  );
  await startInsertedPanel.getByRole("button", { name: "More panel actions" }).click();
  await page.getByRole("menuitem", { name: "Delete panel" }).click();
  const startDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${startInsertedId}`)
  );
  await page
    .getByTestId("panel-action-confirmation")
    .getByRole("button", { name: "Delete panel" })
    .click();
  assert((await startDeleteResponse).ok(), "deleting the temporary top panel failed");
  await startInsertedPanel.waitFor({ state: "detached" });

  const addAtEnd = page.getByRole("button", { name: "Add panel below" }).last();
  const addBox = await addAtEnd.boundingBox();
  const addOpacity = Number(await addAtEnd.evaluate((element) => getComputedStyle(element).opacity));
  assert(addBox && addBox.height >= 32, "add-panel target is too small");
  assert(addOpacity > 0, "add-panel action is visually undiscoverable");
  const insertResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/insert`)
  );
  await addAtEnd.click();
  const insertedResponse = await insertResponse;
  assert(insertedResponse.ok(), "panel insertion failed");
  const insertedPayload = await insertedResponse.json();
  const insertedSectionId = insertedPayload.sectionId;
  assert(insertedSectionId, "panel insertion omitted the new section id");
  await page.waitForURL(
    new RegExp(`/edit/${explainerId}/${insertedSectionId}$`),
    { timeout: 60_000 }
  );
  const insertedCanvasStrip = page.getByTestId("canvas-action-strip");
  await insertedCanvasStrip.waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText("Untitled panel", { exact: true }).first().waitFor();
  await insertedCanvasStrip
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.waitForURL(
    new RegExp(`/e/${explainerId}#panel-${insertedSectionId}$`),
    { timeout: 60_000 }
  );
  const insertedPanel = page.getByTestId(`panel-card-${insertedSectionId}`);
  await insertedPanel.waitFor({ state: "visible" });
  assert(
    (await page.locator('[data-testid^="panel-card-"]').count()) === initialPanelCount + 1,
    "new panel was not added to the story"
  );

  await insertedPanel.getByRole("button", { name: "More panel actions" }).click();
  const moveUpResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/reorder`)
  );
  await page.getByRole("menuitem", { name: "Move panel up" }).click();
  assert((await moveUpResponse).ok(), "moving the inserted panel up failed");
  let panelOrder = await page
    .locator('[data-testid^="panel-card-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
  assert(
    panelOrder.at(-2) === `panel-card-${insertedSectionId}`,
    "inserted panel did not move to the requested position"
  );

  await insertedPanel.getByRole("button", { name: "More panel actions" }).click();
  const moveDownResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/reorder`)
  );
  await page.getByRole("menuitem", { name: "Move panel down" }).click();
  assert((await moveDownResponse).ok(), "moving the inserted panel down failed");
  panelOrder = await page
    .locator('[data-testid^="panel-card-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
  assert(panelOrder.at(-1) === `panel-card-${insertedSectionId}`, "panel order did not persist locally");

  const insertedMore = insertedPanel.getByRole("button", { name: "More panel actions" });
  await insertedMore.click();
  await page.getByRole("menuitem", { name: "Delete panel" }).click();
  const deleteConfirmation = page.getByTestId("panel-action-confirmation");
  await deleteConfirmation.waitFor({ state: "visible" });
  await deleteConfirmation.getByText("Untitled panel", { exact: false }).waitFor();
  await page.waitForFunction(
    () => document.activeElement?.hasAttribute("data-panel-confirm-cancel") === true,
    undefined,
    { timeout: 5_000 }
  );
  await page.keyboard.press("Escape");
  await deleteConfirmation.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "More panel actions",
    undefined,
    { timeout: 5_000 }
  );

  await insertedMore.click();
  await page.getByRole("menuitem", { name: "Delete panel" }).click();
  await deleteConfirmation.waitFor({ state: "visible" });
  const deletePattern = `**/api/explainers/${explainerId}/panels/${insertedSectionId}`;
  await page.route(deletePattern, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Deletion temporarily unavailable." }),
    });
  });
  const consoleErrorsBeforeDeleteFailure = consoleErrors.length;
  await deleteConfirmation.getByRole("button", { name: "Delete panel" }).click();
  await deleteConfirmation
    .getByRole("alert")
    .getByText("Deletion temporarily unavailable.")
    .waitFor();
  assert(await insertedPanel.isVisible(), "failed deletion removed the panel from the story");
  const expectedDeleteConsoleErrors = consoleErrors.slice(consoleErrorsBeforeDeleteFailure);
  assert(
    expectedDeleteConsoleErrors.every((message) => message.includes("status of 503")),
    `unexpected browser error during the simulated delete failure:\n${expectedDeleteConsoleErrors.join("\n")}`
  );
  consoleErrors.splice(consoleErrorsBeforeDeleteFailure);
  await page.unroute(deletePattern);
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${insertedSectionId}`)
  );
  await deleteConfirmation.getByRole("button", { name: "Delete panel" }).click();
  assert((await deleteResponse).ok(), "deleting the inserted panel failed");
  await insertedPanel.waitFor({ state: "detached" });
  assert(
    (await page.locator('[data-testid^="panel-card-"]').count()) === initialPanelCount,
    "panel list did not recover after deleting the temporary panel"
  );

  console.log("→ apply a suggested layout on desktop");
  await layoutTrigger.focus();
  await layoutTrigger.press("Enter");
  const sheet = page.getByTestId("layout-picker-sheet");
  await sheet.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const picker = document.querySelector('[data-testid="layout-picker-sheet"]');
      return picker?.contains(document.activeElement) === true;
    },
    undefined,
    { timeout: 5_000 }
  );
  assert(
    await sheet.evaluate((element) => element.contains(document.activeElement)),
    "layout picker did not receive keyboard focus"
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await sheet.evaluate((element) => element.contains(document.activeElement)),
    "layout picker allowed keyboard focus to escape"
  );
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-controls")?.startsWith("panel-layout-picker-") === true,
    undefined,
    { timeout: 5_000 }
  );
  await layoutTrigger.press("Enter");
  await sheet.waitFor({ state: "visible" });
  assert(
    !(await page.getByTestId("layout-picker-backdrop").isVisible()),
    "desktop layout popover unexpectedly dimmed the full page"
  );
  const sheetBox = await sheet.boundingBox();
  assert(sheetBox, "layout picker has no measurable box");
  assert(sheetBox.x >= 0 && sheetBox.x + sheetBox.width <= 1440, "layout picker escapes desktop viewport");
  await sheet.getByText("Matched from", { exact: true }).waitFor();
  await sheet.getByTestId("layout-automatic-state").waitFor();
  await sheet
    .locator('[data-layout-preview-state="ready"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  const alternate = sheet
    .locator('button[data-layout-id]:not([aria-pressed="true"]):not([disabled])')
    .first();
  const layoutId = await alternate.getAttribute("data-layout-id");
  assert(layoutId, "no compatible desktop layout was offered");
  const layoutSaved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`)
  );
  await alternate.click();
  await sheet.waitFor({ state: "hidden" });
  assert((await layoutSaved).ok(), "desktop suggested layout did not persist");
  await firstPanel.getByTestId("layout-applied-status").waitFor({ state: "attached" });
  assert(
    (await layoutTrigger.getAttribute("aria-label"))?.startsWith("Change panel layout. Current layout:"),
    "desktop layout trigger does not expose the active composition"
  );

  console.log(`→ open ${layoutId} without editing and return safely`);
  const refreshedPanel = page.getByTestId(`panel-card-${sectionId}`);
  await refreshedPanel.waitFor({ state: "visible" });
  const untouchedWrites = [];
  const captureUntouchedWrite = (request) => {
    const isSceneSave =
      request.method() === "POST" &&
      request.url().endsWith(`/api/scenes/${explainerId}/${sectionId}`);
    const isPanelCommit =
      request.method() === "PATCH" &&
      request.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`);
    if (isSceneSave || isPanelCommit) {
      untouchedWrites.push(`${request.method()} ${request.url()}`);
    }
  };
  page.on("request", captureUntouchedWrite);
  await refreshedPanel.getByRole("link", { name: "Customize canvas" }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), { timeout: 60_000 });
  let strip = page.getByTestId("canvas-action-strip");
  await strip.waitFor({ state: "visible" });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await page.waitForTimeout(1_800);
  assert(
    untouchedWrites.length === 0,
    `opening an untouched canvas triggered a write:\n${untouchedWrites.join("\n")}`
  );
  await strip.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForURL(new RegExp(`/e/${explainerId}`), { timeout: 60_000 });
  await page.waitForTimeout(500);
  page.off("request", captureUntouchedWrite);
  assert(
    untouchedWrites.length === 0,
    `leaving an untouched canvas triggered a write:\n${untouchedWrites.join("\n")}`
  );

  console.log(`→ edit ${layoutId} as native desktop canvas elements`);
  const reopenedPanel = page.getByTestId(`panel-card-${sectionId}`);
  await reopenedPanel.waitFor({ state: "visible" });
  await reopenedPanel.getByRole("link", { name: "Customize canvas" }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), { timeout: 60_000 });
  strip = page.getByTestId("canvas-action-strip");
  await strip.waitFor({ state: "visible" });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  for (const name of [
    "Canvas tools",
    "Save panel",
    "Export PNG",
    "Done",
  ]) {
    await strip.getByRole("button", { name, exact: true }).waitFor({ state: "visible" });
  }
  await strip
    .getByTestId("canvas-direct-edit-hint")
    .waitFor({ state: "visible" });
  for (const name of ["Restore from panel", "Start blank", "Import"]) {
    assert(
      !(await strip.getByRole("button", { name, exact: true }).isVisible()),
      `${name} should stay in the laptop-width tools menu`
    );
  }
  await shot(page, "02-canvas.png");

  console.log("→ verify canvas reset decisions and recovery");
  const canvasToolsButton = strip.getByRole("button", { name: "Canvas tools" });
  await canvasToolsButton.click();
  await page.getByRole("menuitem", { name: "Start with a blank canvas" }).click();
  const resetDialog = page.getByTestId("canvas-reset-dialog");
  await resetDialog.waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="canvas-reset-dialog"]')
        ?.contains(document.activeElement),
    undefined,
    { timeout: 5_000 }
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await resetDialog.evaluate((element) => element.contains(document.activeElement)),
    "canvas recovery dialog allowed keyboard focus to escape"
  );
  await page.keyboard.press("Escape");
  await resetDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Canvas tools",
    undefined,
    { timeout: 5_000 }
  );

  await canvasToolsButton.click();
  await page.getByRole("menuitem", { name: "Start with a blank canvas" }).click();
  await resetDialog.waitFor({ state: "visible" });
  const blankDelete = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith(`/api/scenes/${explainerId}/${sectionId}`)
  );
  await resetDialog.getByRole("button", { name: "Start blank", exact: true }).click();
  await page.getByTestId("canvas-fitting").waitFor({ state: "visible", timeout: 10_000 });
  assert((await blankDelete).ok(), "starting blank did not clear the prior draft");
  await resetDialog.waitFor({ state: "hidden" });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });

  await canvasToolsButton.click();
  await page.getByRole("menuitem", { name: "Restore original panel" }).click();
  await resetDialog.waitFor({ state: "visible" });
  await resetDialog.getByText("Your saved panel stays unchanged.", { exact: false }).waitFor();
  const restoreDelete = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().endsWith(`/api/scenes/${explainerId}/${sectionId}`)
  );
  await resetDialog.getByRole("button", { name: "Restore panel", exact: true }).click();
  await page.getByTestId("canvas-fitting").waitFor({ state: "visible", timeout: 10_000 });
  assert((await restoreDelete).ok(), "restoring the panel did not clear the blank draft");
  await resetDialog.waitFor({ state: "hidden" });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await shot(page, "02a-recovered.png");

  const canvas = page.locator("canvas.excalidraw__canvas.interactive:visible");
  await canvas.waitFor({ state: "visible", timeout: 60_000 });
  console.log("→ rewrite existing text directly in the canvas");
  const editor = await openTextEditor(page, canvas, [
    [0.35, 0.14],
    [0.5, 0.14],
    [0.35, 0.18],
    [0.55, 0.18],
    [0.5, 0.32],
    [0.5, 0.4],
    [0.5, 0.48],
  ]);
  assert(editor, "double-click did not open a native desktop text editor");
  const originalText = await editor.inputValue();
  assert(originalText.trim(), "native text editor opened without existing copy");
  await editor.fill("Desktop-edited existing text");
  await page.keyboard.press("Escape");

  console.log("→ add native text with the desktop text tool");
  const box = await canvas.boundingBox();
  assert(box, "canvas has no measurable box after text edit");
  await page.keyboard.press("t");
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.78);
  const newTextEditor = page.locator("textarea:visible");
  await newTextEditor.waitFor({ state: "visible", timeout: 10_000 });
  await newTextEditor.fill("Desktop audit note");
  await page.keyboard.press("Escape");

  const committedPanel = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`)
  );
  await strip.getByRole("button", { name: "Save panel" }).click();
  await strip
    .locator("span:visible")
    .filter({ hasText: /^Panel saved$/ })
    .waitFor({ timeout: 30_000 });
  assert((await committedPanel).ok(), "desktop panel commit failed");
  await shot(page, "03-edited.png");

  const sceneResponse = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${encodeURIComponent(sectionId)}`
  );
  assert(sceneResponse.ok(), `saved scene request failed (${sceneResponse.status()})`);
  const serializedScene = JSON.stringify(await sceneResponse.json());
  assert(serializedScene.includes("Desktop audit note"), "scene lost the new desktop text");
  assert(
    serializedScene.includes("Desktop-edited existing text"),
    "scene lost the desktop rewrite"
  );

  console.log("→ navigate to the next panel and back from the dedicated canvas");
  let fullStrip = page.getByTestId("canvas-action-strip");
  await fullStrip.getByRole("button", { name: /Save and edit next panel/ }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/shared-rhythm$`), { timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  fullStrip = page.getByTestId("canvas-action-strip");
  await fullStrip
    .getByRole("button", { name: /Save and edit previous panel/ })
    .click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), { timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-action-strip").getByRole("button", { name: "Done" }).click();
  await page.waitForURL(new RegExp(`/e/${explainerId}#panel-${sectionId}$`), { timeout: 60_000 });
  const returnedPanel = page.getByTestId(`panel-card-${sectionId}`);
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();

  console.log("→ compare a suggested layout without losing the custom canvas");
  const customLayoutTrigger = returnedPanel.locator(
    'button[aria-controls^="panel-layout-picker-"]'
  );
  assert(
    (await customLayoutTrigger.textContent())?.includes("Canvas custom"),
    "saved canvas was not identified as a custom panel"
  );
  await customLayoutTrigger.click();
  const customLayoutSheet = page.getByTestId("layout-picker-sheet");
  await customLayoutSheet.waitFor({ state: "visible" });
  const replacementChoice = customLayoutSheet
    .locator('button[data-layout-id]:not([disabled])')
    .first();
  const replacementName = await replacementChoice.locator("strong").textContent();
  assert(replacementName?.trim(), "suggested replacement layout has no visible name");
  await replacementChoice.click();
  const replaceConfirmation = customLayoutSheet.getByTestId(
    "layout-replace-confirmation"
  );
  await replaceConfirmation.waitFor({ state: "visible" });
  assert(
    (await replaceConfirmation.textContent())?.includes(replacementName.trim()),
    "custom-canvas confirmation did not name the selected layout"
  );
  await page.waitForFunction(
    () => document.activeElement?.textContent?.trim() === "Keep custom canvas",
    undefined,
    { timeout: 5_000 }
  );
  await replaceConfirmation
    .getByRole("button", { name: "Keep custom canvas" })
    .click();
  await replaceConfirmation.waitFor({ state: "hidden" });
  assert(await customLayoutSheet.isVisible(), "keeping the canvas closed the comparison gallery");
  await page.keyboard.press("Escape");
  await customLayoutSheet.waitFor({ state: "hidden" });
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();

  console.log("→ review a panel reset without discarding the saved canvas");
  const resetTrigger = returnedPanel.getByRole("button", { name: "Reset", exact: true });
  await resetTrigger.click();
  const resetConfirmation = page.getByTestId("panel-action-confirmation");
  await resetConfirmation.waitFor({ state: "visible" });
  await resetConfirmation
    .getByText("Custom canvas and copy edits are removed", { exact: false })
    .waitFor();
  await resetConfirmation.getByRole("button", { name: "Keep panel" }).click();
  await resetConfirmation.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.textContent?.trim() === "Reset",
    undefined,
    { timeout: 5_000 }
  );
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();

  console.log("→ switch identity while preserving the desktop canvas panel");
  const templatesResponse = await page.request.get(`${BASE}/api/templates?explainerId=${explainerId}`);
  assert(templatesResponse.ok(), "desktop template recommendations failed");
  const templatePayload = await templatesResponse.json();
  assert(templatePayload.customPanelCount === 1, "desktop custom panel count is incorrect");
  assert(templatePayload.previewSectionId !== sectionId, "desktop picker previewed the canvas override");
  const alternateTemplate = templatePayload.templates.find(
    (template) => template.recommendation && template.id !== "adaptive-editorial" && !template.locked
  );
  assert(alternateTemplate, "desktop picker had no alternate recommendation");
  const templateTrigger = page.getByRole("button", { name: /Adaptive Editorial/ });
  await templateTrigger.focus();
  await templateTrigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose a mature visual direction." });
  await dialog.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const picker = document.querySelector('[data-testid="template-picker-scroll"]');
      return picker?.contains(document.activeElement) === true;
    },
    undefined,
    { timeout: 5_000 }
  );
  assert(
    (await dialog.evaluate((element) => element.scrollTop)) <= 1,
    "template picker did not open at the ranked recommendations"
  );
  await dialog
    .getByText("Recommended for this story", { exact: true })
    .waitFor({ state: "visible" });
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    "template picker did not receive keyboard focus"
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    "template picker allowed keyboard focus to escape"
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-controls") === "template-picker-dialog",
    undefined,
    { timeout: 5_000 }
  );
  await templateTrigger.press("Enter");
  await dialog.waitFor({ state: "visible" });
  assert(
    (await dialog.evaluate((element) => element.scrollTop)) <= 1,
    "reopened template picker did not reset to the ranked recommendations"
  );
  const switchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}`)
  );
  await dialog.locator(`button[data-template-id="${alternateTemplate.id}"]`).click();
  assert((await switchResponse).ok(), "desktop identity switch failed");
  await dialog.waitFor({ state: "hidden" });
  const activeTemplateTrigger = page.locator(
    'button[aria-controls="template-picker-dialog"]'
  );
  await activeTemplateTrigger
    .filter({ hasText: alternateTemplate.name })
    .waitFor({ state: "visible" });
  assert(
    (await activeTemplateTrigger.textContent())?.includes(alternateTemplate.name),
    "desktop identity label did not update after the rendered direction changed"
  );
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();
  await shot(page, "04-template-switched.png");

  assert(consoleErrors.length === 0, `browser errors:\n${consoleErrors.join("\n")}`);
  console.log(`✓ desktop flow passed (${layoutId}; ${sectionId}; ${alternateTemplate.id})`);
  console.log(`  screenshots: ${OUT}`);
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
