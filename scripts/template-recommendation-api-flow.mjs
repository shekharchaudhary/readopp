/**
 * Storage-backed recommendation contract:
 * fixture source profile → persisted job comprehension → /api/templates rank.
 *
 * Each case creates its own anonymous fixture and deletes only the exact
 * explainer/job rows it created. Run with the local app on port 3000.
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { request as playwrightRequest } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
const FIXTURE_HEADER = "mobile-editor-flow-v1";

const CASES = [
  {
    profile: "research",
    genre: "research_paper",
    expectedTop: "editorial-report",
    signal: /research story/i,
  },
  {
    profile: "data",
    genre: "whitepaper",
    expectedTop: "data-story",
    signal: /numbers or charts/i,
  },
  {
    profile: "technical",
    genre: "documentation",
    expectedTop: "modern-technical",
    signal: /technical source/i,
  },
  {
    profile: "discussion",
    genre: "article",
    expectedTop: "bold-social",
    signal: /visual brief.*bold/i,
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(supabaseUrl && serviceKey, "Supabase admin environment is required");
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = [];

async function cleanup() {
  for (const fixture of created.reverse()) {
    const { data: explainer, error: explainerReadError } = await admin
      .from("explainers")
      .select("id,job_id,title")
      .eq("id", fixture.explainerId)
      .maybeSingle();
    if (explainerReadError) throw explainerReadError;
    assert(
      !explainer ||
        (explainer.job_id === fixture.jobId && explainer.title === FIXTURE_TITLE),
      `refusing cleanup: explainer ${fixture.explainerId} is not this fixture`
    );
    if (explainer) {
      const { error } = await admin
        .from("explainers")
        .delete()
        .eq("id", fixture.explainerId);
      if (error) throw error;
    }

    const { data: job, error: jobReadError } = await admin
      .from("jobs")
      .select("id,url")
      .eq("id", fixture.jobId)
      .maybeSingle();
    if (jobReadError) throw jobReadError;
    assert(
      !job || job.url === FIXTURE_URL,
      `refusing cleanup: job ${fixture.jobId} is not this fixture`
    );
    if (job) {
      const { error } = await admin.from("jobs").delete().eq("id", fixture.jobId);
      if (error) throw error;
    }
  }
}

let api;
try {
  api = await playwrightRequest.newContext({ baseURL: BASE });
  for (const testCase of CASES) {
    console.log(`→ ${testCase.profile} source profile`);
    const fixtureResponse = await api.post("/api/dev/fixtures/mobile-editor", {
      headers: { "x-readopp-e2e": FIXTURE_HEADER },
      data: { profile: testCase.profile },
    });
    assert(
      fixtureResponse.status() === 201,
      `fixture ${testCase.profile} failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
    );
    const fixture = await fixtureResponse.json();
    assert(fixture.jobId && fixture.explainerId, "fixture IDs are missing");
    created.push(fixture);

    const { data: storedJob, error: jobError } = await admin
      .from("jobs")
      .select("style,publishing_goal,pipeline_state")
      .eq("id", fixture.jobId)
      .maybeSingle();
    if (jobError) throw jobError;
    assert(
      storedJob?.pipeline_state?.comprehension?.genre === testCase.genre,
      `${testCase.profile} comprehension was not persisted before ranking`
    );

    const response = await api.get(
      `/api/templates?explainerId=${encodeURIComponent(fixture.explainerId)}`
    );
    assert(
      response.ok(),
      `${testCase.profile} recommendations failed (${response.status()}): ${await response.text()}`
    );
    const payload = await response.json();
    const recommendations = payload.templates
      .filter((template) => template.recommendation)
      .sort(
        (a, b) => a.recommendation.rank - b.recommendation.rank
      );
    assert(
      recommendations.length === 3,
      `${testCase.profile} returned ${recommendations.length} ranked templates`
    );
    const top = recommendations[0];
    assert(
      top.id === testCase.expectedTop,
      `${testCase.profile} expected ${testCase.expectedTop}, received ${top.id}`
    );
    assert(
      testCase.signal.test(top.recommendation.signal),
      `${testCase.profile} recommendation did not explain its saved source signal: ${top.recommendation.signal}`
    );
    assert(
      new Set(recommendations.map((template) => template.id)).size === 3,
      `${testCase.profile} recommendations were not distinct`
    );
    console.log(
      `✓ ${testCase.profile}: ${top.id} — ${top.recommendation.signal}`
    );
  }
  console.log(`✓ ${CASES.length} storage-backed recommendation profiles passed`);
} finally {
  await api?.dispose();
  await cleanup();
}
