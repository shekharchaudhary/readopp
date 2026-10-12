/**
 * Focused per-panel layout ↔ custom-canvas handoff check.
 *
 * Verifies that cancel is non-destructive, confirmed replacement affects only
 * the active panel, one-click undo restores the exact custom canvas + recovery
 * scene, and a final replacement opens the canvas from the chosen layout
 * rather than the stale custom draft. The isolated fixture is always removed.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-layout-canvas-handoff");
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
const SECTION_ID = "protect-focus";
const CUSTOM_MARKER = "Reversible custom canvas marker";
mkdirSync(OUT, { recursive: true });

let browser;
let jobId;
let explainerId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "Supabase admin environment is required");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function storedPanels() {
  const { data, error } = await adminClient()
    .from("explainers")
    .select("panels")
    .eq("id", explainerId)
    .maybeSingle();
  if (error) throw error;
  return data?.panels ?? [];
}

async function storedPanel() {
  return (await storedPanels()).find((panel) => panel.sectionId === SECTION_ID);
}

async function cleanup() {
  if (!jobId && !explainerId) return;
  const admin = adminClient();
  if (explainerId) {
    const { data, error } = await admin
      .from("explainers")
      .select("id,job_id,title")
      .eq("id", explainerId)
      .maybeSingle();
    if (error) throw error;
    assert(
      !data || (data.job_id === jobId && data.title === FIXTURE_TITLE),
      `refusing cleanup: explainer ${explainerId} is not this fixture`
    );
    if (data) {
      const { error: deleteError } = await admin
        .from("explainers")
        .delete()
        .eq("id", explainerId);
      if (deleteError) throw deleteError;
    }
  }
  if (jobId) {
    const { data, error } = await admin
      .from("jobs")
      .select("id,url")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    assert(
      !data || data.url === FIXTURE_URL,
      `refusing cleanup: job ${jobId} is not this fixture`
    );
    if (data) {
      const { error: deleteError } = await admin
        .from("jobs")
        .delete()
        .eq("id", jobId);
      if (deleteError) throw deleteError;
    }
  }
}

async function addText(page, text) {
  const strip = page.getByTestId("canvas-action-strip");
  await strip.getByRole("button", { name: "Canvas tools" }).click();
  await page.getByRole("menuitem", { name: "Add text to canvas" }).click();
  const composer = page.getByTestId("canvas-text-composer");
  await composer.waitFor({ state: "visible" });
  await composer.getByLabel("Text to add to this panel").fill(text);
  await composer.getByRole("button", { name: "Add to canvas" }).click();
  await composer.waitFor({ state: "hidden" });
}

async function openLayoutPicker(page) {
  const trigger = page.locator(
    `[data-testid="panel-card-${SECTION_ID}"] button[aria-controls^="panel-layout-picker-"]`
  );
  await trigger.click();
  const sheet = page.getByTestId("layout-picker-sheet");
  await sheet.waitFor({ state: "visible" });
  return sheet;
}

async function chooseAlternativeLayout(sheet) {
  const buttons = sheet.locator("button[data-layout-id]:not([disabled])");
  const count = await buttons.count();
  assert(count >= 2, "layout picker did not offer an alternative compatible layout");
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if ((await button.getAttribute("aria-pressed")) !== "true") {
      const layout = await button.getAttribute("data-layout-id");
      assert(layout, "alternative layout is missing its id");
      await button.click();
      return layout;
    }
  }
  throw new Error("layout picker only exposed the current layout");
}

async function confirmReplacement(page, sheet, layoutId) {
  const confirmation = page.getByTestId("layout-replace-confirmation");
  await confirmation.waitFor({ state: "visible" });
  const panelPatch = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(
        `/api/explainers/${explainerId}/panels/${SECTION_ID}`
      )
  );
  await confirmation.locator("button").filter({ hasText: /^Use / }).click();
  assert((await panelPatch).ok(), `could not apply ${layoutId}`);
  await sheet.waitFor({ state: "hidden" });
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  console.log("→ create isolated layout/canvas fixture");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const fixtureResponse = await page.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    { headers: { "x-readopp-e2e": "mobile-editor-flow-v1" } }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  explainerId = fixture.explainerId;

  console.log("→ create and commit an exact-panel custom canvas");
  await page.goto(`${BASE}/edit/${explainerId}/${SECTION_ID}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await addText(page, CUSTOM_MARKER);
  const panelCommit = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(
        `/api/explainers/${explainerId}/panels/${SECTION_ID}`
      )
  );
  await page.getByTestId("canvas-action-strip").getByRole("button", { name: "Save panel" }).click();
  assert((await panelCommit).ok(), "custom canvas did not commit to the panel");
  await page
    .getByTestId("canvas-action-strip")
    .getByText("Panel saved", { exact: true })
    .waitFor();
  const savedSceneResponse = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${SECTION_ID}`
  );
  assert(savedSceneResponse.ok(), "custom recovery scene could not be read");
  const savedScene = JSON.stringify(await savedSceneResponse.json());
  assert(savedScene.includes(CUSTOM_MARKER), "custom recovery scene lost its marker");
  await page.getByTestId("canvas-action-strip").getByRole("button", { name: "Done" }).click();
  await page.waitForURL(new RegExp(`/e/${explainerId}#panel-${SECTION_ID}$`), {
    timeout: 60_000,
  });

  const originalPanel = await storedPanel();
  assert(
    String(originalPanel?.content).includes('data-readopp-canvas-override="true"'),
    "fixture panel was not committed as a canvas override"
  );
  const untouchedPanelsBefore = (await storedPanels())
    .filter((panel) => panel.sectionId !== SECTION_ID)
    .map((panel) => JSON.stringify(panel));

  console.log("→ cancel replacement without mutating the custom panel");
  let sheet = await openLayoutPicker(page);
  const layoutId = await chooseAlternativeLayout(sheet);
  const confirmation = page.getByTestId("layout-replace-confirmation");
  await confirmation.waitFor({ state: "visible" });
  await confirmation.getByRole("button", { name: "Keep custom canvas" }).click();
  await confirmation.waitFor({ state: "hidden" });
  assert(
    JSON.stringify(await storedPanel()) === JSON.stringify(originalPanel),
    "canceling a layout replacement changed the custom panel"
  );

  console.log("→ confirm replacement, then undo it in one click");
  await sheet.locator(`button[data-layout-id="${layoutId}"]`).click();
  await confirmReplacement(page, sheet, layoutId);
  const replacedPanel = await storedPanel();
  assert(replacedPanel?.layoutVariant === layoutId, "selected layout was not persisted");
  assert(
    !String(replacedPanel?.content).includes("data-readopp-canvas-override"),
    "confirmed replacement still rendered the custom canvas"
  );
  assert(
    String(replacedPanel?.content).includes(CUSTOM_MARKER),
    "replacement discarded the recoverable custom SVG"
  );
  const status = page.getByTestId("layout-applied-status");
  await status.waitFor({ state: "visible" });
  await page.screenshot({
    path: join(OUT, "01-layout-applied-with-undo.png"),
    fullPage: true,
  });
  const undoPatch = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(
        `/api/explainers/${explainerId}/panels/${SECTION_ID}`
      )
  );
  await status.getByRole("button", { name: "Undo" }).click();
  assert((await undoPatch).ok(), "one-click custom canvas restore failed");
  await status.waitFor({ state: "hidden" });
  const restoredPanel = await storedPanel();
  assert(
    String(restoredPanel?.content).includes('data-readopp-canvas-override="true"') &&
      String(restoredPanel?.content).includes(CUSTOM_MARKER),
    "undo did not restore the exact custom panel"
  );
  const sceneAfterUndo = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${SECTION_ID}`
  );
  assert(sceneAfterUndo.ok(), "custom scene disappeared after undo");
  assert(
    JSON.stringify(await sceneAfterUndo.json()) === savedScene,
    "layout handoff mutated the recoverable custom scene"
  );

  console.log("→ replace again and open canvas from the exact chosen layout");
  sheet = await openLayoutPicker(page);
  await sheet.locator(`button[data-layout-id="${layoutId}"]`).click();
  await confirmReplacement(page, sheet, layoutId);
  await page
    .getByTestId(`panel-card-${SECTION_ID}`)
    .getByRole("link", { name: "Customize canvas" })
    .click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${SECTION_ID}$`), {
    timeout: 60_000,
  });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  assert(
    (await page.getByTestId("canvas-recovery-status").count()) === 0,
    "chosen layout reopened the stale custom recovery draft"
  );
  const currentScene = await page.locator(".excalidraw").evaluate(() =>
    document.body.innerText.includes("Reversible custom canvas marker")
  );
  assert(!currentScene, "chosen layout canvas still showed the old custom marker");
  await page.screenshot({
    path: join(OUT, "02-chosen-layout-canvas.png"),
    fullPage: true,
  });

  const untouchedPanelsAfter = (await storedPanels())
    .filter((panel) => panel.sectionId !== SECTION_ID)
    .map((panel) => JSON.stringify(panel));
  assert(
    JSON.stringify(untouchedPanelsAfter) === JSON.stringify(untouchedPanelsBefore),
    "layout/canvas handoff changed another panel"
  );
  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log(`✓ reversible layout/canvas handoff passed (${layoutId}; ${SECTION_ID})`);
  console.log(`  screenshots: ${OUT}`);
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
