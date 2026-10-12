/**
 * Focused keyboard regression for a panel's overflow actions.
 *
 * Repeats the open → navigate → Escape cycle to catch focus restoration
 * races without paying the cost of the complete canvas editor flow.
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";

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

async function storedPanels() {
  const { data, error } = await adminClient()
    .from("explainers")
    .select("panels")
    .eq("id", explainerId)
    .maybeSingle();
  if (error) throw error;
  assert(data?.panels, "fixture panels are unavailable");
  return data.panels;
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  console.log("→ create isolated panel-actions fixture");
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

  const panel = page.locator('[data-testid^="panel-card-"]').first();
  await panel.waitFor({ state: "visible" });
  const panelId = (await panel.getAttribute("data-testid"))?.replace("panel-card-", "");
  assert(panelId, "first panel id is missing");
  const trigger = panel.getByRole("button", { name: "More panel actions" });

  console.log("→ repeat keyboard open, navigation, and Escape restoration");
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await trigger.focus();
    await trigger.press("Enter");
    const menu = page.getByRole("menu", {
      name: `Actions for ${await panel.locator("h2").innerText()}`,
    });
    await menu.waitFor({ state: "visible" });
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("role") === "menuitem"
    );
    await page.keyboard.press("End");
    assert(
      (await page.locator(":focus").textContent())?.includes("Delete panel"),
      `cycle ${cycle + 1}: End did not focus the last menu action`
    );
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (id) =>
        document.activeElement?.getAttribute("aria-label") === "More panel actions" &&
        document.activeElement
          ?.closest('[data-testid^="panel-card-"]')
          ?.getAttribute("data-testid") === `panel-card-${id}`,
      panelId
    );
  }

  console.log("→ change one panel color without affecting adjacent panels");
  const beforePanels = await storedPanels();
  await trigger.click();
  const colorAction = panel.getByRole("menuitem", { name: "Change panel colors" });
  await colorAction.click();
  const themeDialog = panel.getByRole("dialog", { name: "Panel theme" });
  await themeDialog.waitFor({ state: "visible" });
  assert(
    (await page.locator(":focus").getAttribute("aria-label")) === "Recolor to blue",
    "panel theme did not focus its first color choice"
  );
  const colorPatch = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${panelId}`)
  );
  await themeDialog.getByRole("button", { name: "Recolor to teal" }).click();
  assert((await colorPatch).ok(), "panel color update failed");
  const afterPanels = await storedPanels();
  assert(afterPanels[0]?.themeColor === "#0F6E56", "chosen panel color was not persisted");
  assert(
    JSON.stringify(afterPanels.slice(1)) === JSON.stringify(beforePanels.slice(1)),
    "changing one panel color modified another panel"
  );
  await page.keyboard.press("Escape");
  await themeDialog.waitFor({ state: "hidden" });
  assert(
    await trigger.evaluate((element) => element === document.activeElement),
    "panel theme Escape did not restore overflow-menu focus"
  );

  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log("✓ panel actions passed (5 focus cycles + isolated color change)");
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
