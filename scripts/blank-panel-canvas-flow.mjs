/**
 * Focused authoring regression for the blank-panel path:
 * add above → exact canvas → add original text → save → exact story panel.
 *
 * The fixture belongs to the browser's anonymous session and is deleted in
 * `finally`. It never invokes a model or touches an existing library item.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-blank-panel-canvas");
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
const ORIGINAL_TITLE = "Make room for the idea worth sharing";
const ORIGINAL_COPY = "One clear insight can become a useful visual story.";

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
  assert(Array.isArray(data?.panels), "fixture panels are unavailable");
  return data.panels;
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
      const { error: deleteError } = await admin.from("jobs").delete().eq("id", jobId);
      if (deleteError) throw deleteError;
    }
  }
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  console.log("→ create an isolated story");
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
  assert(jobId && explainerId, "fixture did not return story identifiers");

  console.log("→ add a panel above and open its exact canvas");
  await page.goto(`${BASE}/e/${explainerId}`, { waitUntil: "networkidle" });
  await page.locator('[data-testid^="panel-card-"]').first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
  const addPanelAbove = page.getByRole("button", { name: "Add panel above" });
  await addPanelAbove.waitFor({ state: "visible", timeout: 60_000 });
  await addPanelAbove.click({ trial: true });
  const [insertedResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/explainers/${explainerId}/panels/insert`),
      { timeout: 60_000 }
    ),
    addPanelAbove.click(),
  ]);
  assert(insertedResponse.ok(), "blank panel insertion failed");
  const { sectionId } = await insertedResponse.json();
  assert(sectionId, "blank panel insertion omitted its section id");
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), {
    timeout: 60_000,
  });

  const strip = page.getByTestId("canvas-action-strip");
  await strip.waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  const canvas = page.locator("canvas.excalidraw__canvas.interactive:visible");
  await canvas.waitFor({ state: "visible", timeout: 60_000 });

  console.log("→ name the new panel inside its canvas");
  const titleComposer = page.getByTestId("canvas-text-composer");
  await titleComposer.waitFor({ state: "visible", timeout: 10_000 });
  await titleComposer.getByLabel("Panel title").fill(ORIGINAL_TITLE);
  await titleComposer.getByRole("button", { name: "Use title" }).click();
  await titleComposer.waitFor({ state: "hidden", timeout: 10_000 });

  console.log("→ add supporting text and save the new panel");
  const canvasTools = strip.getByRole("button", { name: "Canvas tools" });
  await canvasTools.click();
  await page.getByRole("menuitem", { name: "Add text to canvas" }).click();
  const composer = page.getByTestId("canvas-text-composer");
  await composer.waitFor({ state: "visible", timeout: 10_000 });
  await composer.getByLabel("Text to add to this panel").fill(ORIGINAL_COPY);
  await composer.getByRole("button", { name: "Add to canvas" }).click();
  await composer.waitFor({ state: "hidden", timeout: 10_000 });

  const panelCommit = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`)
  );
  await strip.getByRole("button", { name: "Save panel", exact: true }).click();
  assert((await panelCommit).ok(), "authored blank panel did not persist");
  await strip
    .locator("span:visible")
    .filter({ hasText: /^Panel saved$/ })
    .waitFor({ timeout: 30_000 });

  const sceneResponse = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${encodeURIComponent(sectionId)}`
  );
  assert(sceneResponse.ok(), "saved blank-panel scene is unavailable");
  assert(
    JSON.stringify(await sceneResponse.json()).includes(ORIGINAL_COPY),
    "editable scene lost the creator's text"
  );

  const panelsAfterSave = await storedPanels();
  const savedPanel = panelsAfterSave.find((panel) => panel.sectionId === sectionId);
  assert(savedPanel, "saved blank panel is missing from the story");
  assert(savedPanel.edited === true, "saved blank panel is not marked edited");
  assert(savedPanel.heading === ORIGINAL_TITLE, "canvas title did not update the story label");
  assert(
    savedPanel.content.includes('data-readopp-canvas-override="true"'),
    "saved blank panel did not become a complete canvas override"
  );
  assert(savedPanel.content.includes(ORIGINAL_TITLE), "saved panel SVG lost the canvas title");
  assert(savedPanel.content.includes(ORIGINAL_COPY), "saved panel SVG lost the creator's text");

  console.log("→ return to the exact panel and verify the visible result");
  await strip.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForURL(new RegExp(`/e/${explainerId}#panel-${sectionId}$`), {
    timeout: 60_000,
  });
  const authoredPanel = page.getByTestId(`panel-card-${sectionId}`);
  await authoredPanel.waitFor({ state: "visible", timeout: 60_000 });
  const orderedPanelIds = await page
    .locator('[data-testid^="panel-card-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
  assert(
    orderedPanelIds[0] === `panel-card-${sectionId}`,
    "authored top panel moved to a different position"
  );
  await authoredPanel.getByRole("heading", { name: ORIGINAL_TITLE }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await authoredPanel.getByText(ORIGINAL_COPY, { exact: false }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.screenshot({ path: join(OUT, "authored-panel.png"), fullPage: false });

  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log(`✓ blank panel authored, saved, and rendered (${sectionId})`);
  console.log(`  screenshot: ${join(OUT, "authored-panel.png")}`);
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
