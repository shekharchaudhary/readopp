/**
 * Proves that a private creation job is readable only from the browser session
 * that owns it. The finished /e/:id story remains the explicit sharing surface.
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const FIXTURE_HEADER = "mobile-editor-flow-v1";
const FIXTURE_URL = "fixture://mobile-editor";

let browser;
let jobId;
let explainerId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (!jobId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "Supabase admin environment is required for cleanup");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (explainerId) {
    const { error } = await admin
      .from("explainers")
      .delete()
      .eq("id", explainerId)
      .eq("job_id", jobId);
    if (error) throw error;
  }
  const { data, error: lookupError } = await admin
    .from("jobs")
    .select("id,url")
    .eq("id", jobId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  assert(
    !data || data.url === FIXTURE_URL,
    `refusing cleanup: job ${jobId} is not this fixture`
  );
  if (data) {
    const { error } = await admin.from("jobs").delete().eq("id", jobId);
    if (error) throw error;
  }
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const owner = await browser.newContext();
  const stranger = await browser.newContext();
  const ownerPage = await owner.newPage();
  const strangerPage = await stranger.newPage();

  await ownerPage.goto(BASE, { waitUntil: "domcontentloaded" });
  const fixtureResponse = await ownerPage.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    {
      headers: { "x-readopp-e2e": FIXTURE_HEADER },
      data: {},
    }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  explainerId = fixture.explainerId;

  const ownerMeta = await ownerPage.request.get(`${BASE}/api/jobs/${jobId}`);
  assert(ownerMeta.status() === 200, "the owner could not read their job");
  const ownerStream = await ownerPage.request.get(
    `${BASE}/api/jobs/${jobId}/stream`,
    { timeout: 10_000 }
  );
  assert(ownerStream.status() === 200, "the owner could not open their job stream");

  await strangerPage.goto(BASE, { waitUntil: "domcontentloaded" });
  const strangerMeta = await strangerPage.request.get(`${BASE}/api/jobs/${jobId}`);
  const strangerStream = await strangerPage.request.get(
    `${BASE}/api/jobs/${jobId}/stream`
  );
  assert(strangerMeta.status() === 404, "another session could read private job metadata");
  assert(strangerStream.status() === 404, "another session could read private job events");

  console.log("✓ private creation metadata and progress stay in the owning session");
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
