/**
 * Focused mobile template-gallery check.
 *
 * Proves the first recommended card exposes an explicit action in the initial
 * viewport, preview taps/swipes are non-destructive, and the action itself is
 * the only control that persists a visual-direction change.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-mobile-template-picker");
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
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

async function storedTemplate() {
  const { data, error } = await adminClient()
    .from("explainers")
    .select("template")
    .eq("id", explainerId)
    .maybeSingle();
  if (error) throw error;
  return data?.template;
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

async function main() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  console.log("→ create isolated mobile template fixture");
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
  await page.goto(`${BASE}/e/${explainerId}`, { waitUntil: "networkidle" });

  console.log("→ open ranked directions and verify immediate action visibility");
  const templateTrigger = page.locator(
    'button[aria-controls="template-picker-dialog"]'
  );
  await templateTrigger.waitFor({ state: "visible" });
  await templateTrigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Choose a mature visual direction.",
  });
  await dialog.waitFor({ state: "visible" });
  const cards = dialog.locator('[data-template-card-id]');
  await cards.first().waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-template-card-id] [data-template-preview-state="ready"]'
      ).length >= 1,
    undefined,
    { timeout: 60_000 }
  );
  const firstCard = cards.first();
  const firstAction = firstCard.locator('button[data-template-id]');
  const actionBox = await firstAction.boundingBox();
  assert(actionBox, "first recommended template action has no layout box");
  assert(
    actionBox.y < 844 && Math.min(actionBox.y + actionBox.height, 844) - actionBox.y >= 30,
    `first recommended template action is not visible in the initial viewport (y=${actionBox.y})`
  );
  const cardBox = await firstCard.boundingBox();
  assert(
    cardBox && cardBox.width <= 280,
    `mobile card is too wide to compare adjacent choices (${cardBox?.width}px)`
  );
  await page.screenshot({
    path: join(OUT, "01-visible-template-action.png"),
    fullPage: false,
  });

  console.log("→ preview interaction stays non-destructive");
  const originalTemplate = await storedTemplate();
  const preview = firstCard.locator('[data-template-preview-state="ready"]');
  const previewBox = await preview.boundingBox();
  assert(previewBox, "first template preview has no layout box");
  await page.mouse.click(
    previewBox.x + previewBox.width / 2,
    previewBox.y + previewBox.height / 2
  );
  await page.waitForTimeout(250);
  assert(await dialog.isVisible(), "tapping a preview unexpectedly closed the picker");
  assert(
    (await storedTemplate()) === originalTemplate,
    "tapping a preview unexpectedly changed the template"
  );

  console.log("→ explicit action persists the selected direction");
  const alternative = dialog
    .locator('button[data-template-id]:not([disabled])')
    .first();
  const alternativeId = await alternative.getAttribute("data-template-id");
  assert(alternativeId, "no usable alternate template action was available");
  const patch = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}`)
  );
  await alternative.click();
  assert((await patch).ok(), "explicit template action failed");
  await dialog.waitFor({ state: "hidden" });
  assert(
    (await storedTemplate()) === alternativeId,
    "explicit template action was not persisted"
  );
  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log(`✓ mobile template picker passed (${alternativeId})`);
  console.log(`  screenshot: ${OUT}`);
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
