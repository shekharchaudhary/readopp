/**
 * Focused no-model check for the editorial decision step.
 *
 * Proves the source-aware recommendation is understandable, an exact 1–5
 * panel override is easy to make, direction edits remain intact, and the
 * approval payload carries all three decisions without starting generation.
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const FIXTURE_URL = "fixture://mobile-editor";
const FIXTURE_HEADER = "mobile-editor-flow-v1";

let browser;
let jobId;

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
  if (!jobId) return;
  const admin = adminClient();
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

async function main() {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    const expectedRetryResponse =
      text.includes("Failed to load resource") && text.includes("503");
    if (message.type() === "error" && !expectedRetryResponse) {
      browserErrors.push(text);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  console.log("→ create isolated editorial-brief fixture");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const fixtureResponse = await page.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    {
      headers: { "x-readopp-e2e": FIXTURE_HEADER },
      data: { stage: "brief" },
    }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  // The job screen intentionally holds an SSE connection open, so waiting for
  // networkidle would never describe readiness here.
  await page.goto(`${BASE}/j/${jobId}`, { waitUntil: "domcontentloaded" });

  console.log("→ verify recommendation and choose an exact story length");
  const briefCard = page.getByRole("group", { name: "Story length", exact: true });
  await briefCard.waitFor({ state: "visible" });
  const lengthGroup = page.getByRole("group", { name: "Choose story length" });
  await lengthGroup.waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Shape your story" }).waitFor();
  assert(
    (await briefCard.textContent())?.includes("We recommend 2–3 panels"),
    "the source-aware panel recommendation is not visible"
  );
  const auto = lengthGroup.getByRole("button", { name: "Auto" });
  assert((await auto.getAttribute("aria-pressed")) === "true", "Auto is not the default");
  const fivePanels = lengthGroup.getByRole("button", { name: "5 panels" });
  await fivePanels.click();
  assert(
    (await fivePanels.getAttribute("aria-pressed")) === "true" &&
      (await auto.getAttribute("aria-pressed")) === "false",
    "the exact panel choice is not reflected in the controls"
  );

  console.log("→ preserve angle selection and wording in the approval payload");
  await page
    .getByRole("button", { name: "Compare other angles or edit the wording" })
    .click();
  assert(
    await page.getByText("Every interruption spends capacity", { exact: false }).isVisible(),
    "the alternative direction's actual hook is hidden while comparing"
  );
  await page.getByRole("button", { name: "Choose Evidence first direction" }).click();
  const hook = page.getByLabel("Opening hook");
  await hook.fill("A focused, edited evidence hook.");

  let approvalPayload;
  let approvalAttempts = 0;
  await page.route(`**/api/jobs/${jobId}/brief`, async (route) => {
    approvalAttempts += 1;
    approvalPayload = route.request().postDataJSON();
    if (approvalAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary test failure" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ job: { id: jobId, status: "queued" } }),
    });
  });
  await page.getByRole("button", { name: "Create this story →" }).click();
  await page.getByText("Temporary test failure", { exact: true }).waitFor();
  assert(
    await page.getByRole("button", { name: "Create this story →" }).isEnabled(),
    "a failed approval left the production action stuck"
  );
  await page.getByRole("button", { name: "Create this story →" }).click();
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button")).find((item) =>
      item.textContent?.includes("Starting production")
    );
    return Boolean(button);
  });
  assert(approvalPayload?.approve === true, "approval flag is missing");
  assert(approvalAttempts === 2, "the approval action did not recover for a retry");
  assert(
    approvalPayload?.brief?.storyLength?.target === 5,
    "the exact five-panel choice was not submitted"
  );
  assert(
    approvalPayload?.brief?.selectedDirectionId === "evidence",
    "the selected editorial direction was not submitted"
  );
  assert(
    approvalPayload?.brief?.directions?.find((item) => item.id === "evidence")?.hook ===
      "A focused, edited evidence hook.",
    "the edited hook was not submitted"
  );
  assert(browserErrors.length === 0, `browser errors:\n${browserErrors.join("\n")}`);
  console.log("✓ editorial brief passed (recommendation + exact depth + edited angle)");
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
