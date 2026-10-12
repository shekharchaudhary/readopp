/**
 * Focused crash/navigation recovery check for the per-panel canvas.
 *
 * Verifies background draft persistence, server-side restoration after a
 * full reload, and synchronous scene + panel commit before adjacent-panel
 * navigation. The fixture is isolated and deleted in finally.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-canvas-recovery");
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
mkdirSync(OUT, { recursive: true });

let browser;
let jobId;
let explainerId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (!jobId && !explainerId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
      const { error: deleteError } = await admin.from("jobs").delete().eq("id", jobId);
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

  console.log("→ create isolated canvas recovery fixture");
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
  const sectionId = "protect-focus";

  console.log("→ open the exact panel canvas and create a recoverable draft");
  await page.goto(`${BASE}/edit/${explainerId}/${sectionId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await addText(page, "Draft recovery marker");
  await page
    .getByTestId("canvas-action-strip")
    .getByText("Draft saved", { exact: true })
    .waitFor({ timeout: 30_000 });
  const beforeReload = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${sectionId}`
  );
  assert(beforeReload.ok(), "draft scene was not saved");
  const beforeReloadText = JSON.stringify(await beforeReload.json());
  assert(beforeReloadText.includes("Draft recovery marker"), "saved scene lost the draft marker");

  console.log("→ reload and restore the saved scene instead of reseeding");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-recovery-status").waitFor({ state: "visible" });
  const afterReload = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${sectionId}`
  );
  assert(afterReload.ok(), "draft scene disappeared during reload");
  assert(
    JSON.stringify(await afterReload.json()) === beforeReloadText,
    "restoring the canvas mutated the saved draft"
  );
  await page.screenshot({
    path: join(OUT, "01-restored-draft.png"),
    fullPage: true,
  });

  console.log("→ commit a fresh dirty edit before adjacent-panel navigation");
  await addText(page, "Navigation flush marker");
  await page
    .getByTestId("canvas-action-strip")
    .getByText("Saving in 1.5s", { exact: true })
    .waitFor();
  const sceneSave = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/scenes/${explainerId}/${sectionId}`)
  );
  const panelCommit = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`)
  );
  await page
    .getByTestId("canvas-action-strip")
    .getByRole("button", { name: /Save and edit next panel/ })
    .click();
  assert((await sceneSave).ok(), "navigation did not save the recovery scene");
  assert((await panelCommit).ok(), "navigation did not commit the visible panel");
  await page.waitForURL(new RegExp(`/edit/${explainerId}/shared-rhythm$`), {
    timeout: 60_000,
  });

  const savedScene = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${sectionId}`
  );
  assert(savedScene.ok(), "committed recovery scene cannot be read");
  const savedSceneText = JSON.stringify(await savedScene.json());
  assert(
    savedSceneText.includes("Draft recovery marker") &&
      savedSceneText.includes("Navigation flush marker"),
    "navigation did not preserve the complete recovered draft"
  );

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: stored, error } = await admin
    .from("explainers")
    .select("panels")
    .eq("id", explainerId)
    .maybeSingle();
  if (error) throw error;
  const committedPanel = stored?.panels?.find(
    (panel) => panel.sectionId === sectionId
  );
  assert(
    committedPanel?.edited === true &&
      String(committedPanel.content).includes("Navigation flush marker"),
    "navigation saved the draft but did not commit the panel users preview/export"
  );
  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log("✓ reload recovery and adjacent-panel commit passed");
  console.log(`  screenshot: ${OUT}`);
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
