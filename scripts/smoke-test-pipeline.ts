/**
 * End-of-phase smoke test for the panel-quality refactor (Phase 2).
 *
 * Runs the FULL pipeline (ingest → comprehension → outline → plan →
 * render → assembly) against a small set of diverse URLs and dumps
 * each resulting panel as SVG + metadata into tmp/smoke-test/. An
 * HTML index displays the panels grouped by source URL with the
 * planner's chosen visualType for each panel — so we can see whether
 * the planner actually exercises the new templates (insight,
 * framework, before_after, quadrant, paradox, onion, tipping_point).
 *
 * Bypasses HTTP / auth by calling createJob + runJob directly. Costs
 * real Anthropic tokens (one full explainer per URL).
 *
 *   npx tsx -r dotenv/config scripts/smoke-test-pipeline.ts dotenv_config_path=.env.local
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Inline .env.local loader so the script runs without an extra dotenv
// dep. Skips empty/comment lines, doesn't overwrite already-set vars.
loadEnvFile(join(process.cwd(), ".env.local"));

function loadEnvFile(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (key in process.env) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

import { createJob, getJob } from "../lib/store";
import { runJob } from "../lib/pipeline/orchestrator";
import { getAdminSupabase } from "../lib/supabase/server";
import { ExplainerSchema } from "../lib/shared/schemas";
import type { AudienceLevel, Explainer } from "../lib/shared/schemas";

/**
 * getExplainer() in lib/store uses getServerSupabase() which requires
 * Next's request-scoped cookies() — fine in production, fails in a
 * standalone tsx script. Read the row via the admin client instead;
 * Explainer rows are public-read anyway so no auth is needed.
 */
async function readExplainerViaAdmin(id: string): Promise<Explainer | undefined> {
  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin
    .from("explainers")
    .select("*")
    .eq("id", id)
    .maybeSingle() as any);
  if (!data) return undefined;
  return ExplainerSchema.parse({
    id: data.id,
    jobId: data.job_id,
    url: data.url,
    audienceLevel: data.audience_level,
    title: data.title,
    summary: data.summary,
    panels: data.panels,
    socialPack: data.social_pack ?? undefined,
    template: data.template ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at ?? undefined,
  });
}

/**
 * The jobs table has a FK on user_id → auth.users.id, so we can't
 * mint a random UUID — we need a real auth user. Pick any existing
 * one (they're all anon users from prior testing); the smoke test
 * doesn't depend on ownership, just on a satisfied FK.
 */
/**
 * Wipe any cached explainers for this URL/user pair so the pipeline
 * always runs fresh during the smoke test. Without this, the cache hit
 * in runJob calls completeJob → insertExplainer with the existing id
 * and hits a unique-key violation. (That's a real production bug in
 * the cache-hit path; tracked separately.)
 */
async function clearCachedExplainersFor(userId: string, urls: string[]) {
  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("explainers").delete().eq("user_id", userId).in("url", urls) as any);
  if (error) {
    console.warn(`Could not clear cached explainers: ${error.message}`);
  }
}

async function pickAnyUserId(): Promise<string> {
  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.auth as any).admin.listUsers({
    page: 1,
    perPage: 1,
  });
  if (error || !data?.users?.[0]?.id) {
    throw new Error(
      `No existing users found — sign in once via the web UI to seed one. (${error?.message ?? "empty"})`
    );
  }
  return data.users[0].id as string;
}

const OUT_DIR = join(process.cwd(), "tmp", "smoke-test");
mkdirSync(OUT_DIR, { recursive: true });

interface Target {
  label: string;
  url: string;
  audience: AudienceLevel;
}

// Three deliberately varied sources so we test how the planner routes
// different content shapes through the new templates.
const TARGETS: Target[] = [
  {
    label: "essay",
    url: "https://www.paulgraham.com/cities.html",
    audience: "general",
  },
  {
    label: "engineering essay",
    url: "https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/",
    audience: "general",
  },
  {
    label: "engineering long-form",
    url: "https://blog.cloudflare.com/the-history-of-the-url",
    audience: "professional",
  },
];

async function runOne(
  target: Target,
  userId: string
): Promise<{ target: Target; explainer: Explainer | null; error?: string }> {
  // eslint-disable-next-line no-console
  console.log(`\n[${target.label}] ${target.url}`);
  try {
    const job = await createJob({
      url: target.url,
      audienceLevel: target.audience,
      userId,
    });
    // eslint-disable-next-line no-console
    console.log(`  job=${job.id} — running pipeline...`);
    const t0 = Date.now();
    await runJob(job.id);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const refreshed = await getJob(job.id);
    if (!refreshed?.explainerId) {
      return {
        target,
        explainer: null,
        error: `pipeline finished without an explainerId (status=${refreshed?.status})`,
      };
    }
    const explainer = await readExplainerViaAdmin(refreshed.explainerId);
    if (!explainer) {
      return { target, explainer: null, error: "explainer row not found" };
    }
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${explainer.panels.length} panels in ${dt}s`);
    return { target, explainer };
  } catch (e) {
    return { target, explainer: null, error: (e as Error).message ?? String(e) };
  }
}

async function main() {
  const userId = await pickAnyUserId();
  // eslint-disable-next-line no-console
  console.log(`Using existing user_id ${userId.slice(0, 8)}… for smoke jobs`);
  await clearCachedExplainersFor(
    userId,
    TARGETS.map((t) => t.url)
  );
  const results = [];
  for (const target of TARGETS) {
    results.push(await runOne(target, userId));
  }

  // ---------- Write outputs ----------

  // Tally visualType usage so we can see which templates fired.
  const typeCount = new Map<string, number>();
  const tierATypes = new Set([
    "quote_card",
    "key_findings",
    "definition_card",
    "chart",
    "insight",
    "framework",
    "before_after",
  ]);
  const newTypes = new Set(["insight", "framework", "before_after"]);
  const newMetaphors = new Set([
    "paradox",
    "quadrant",
    "onion",
    "tipping_point",
  ]);

  const sections: string[] = [];
  for (const { target, explainer, error } of results) {
    if (!explainer) {
      sections.push(`
        <section class="src failed">
          <h2>${escape(target.label)} — <small>${escape(target.url)}</small></h2>
          <p class="err">FAILED — ${escape(error ?? "unknown")}</p>
        </section>
      `);
      continue;
    }
    const panelRows = explainer.panels.map((p, i) => {
      const vt = p.plan?.visualType ?? "(no plan)";
      typeCount.set(vt, (typeCount.get(vt) ?? 0) + 1);
      const mk = p.plan?.metaphor?.kind;
      const isNew = newTypes.has(vt) || (mk && newMetaphors.has(mk));
      const isTierA = tierATypes.has(vt);
      const badge = isNew
        ? `<span class="badge new">NEW</span>`
        : isTierA
          ? `<span class="badge tierA">TIER A</span>`
          : "";
      const filename = `${target.label.replace(/[^a-z0-9]+/gi, "-")}__${String(i + 1).padStart(2, "0")}-${p.sectionId.slice(0, 10)}.svg`;
      writeFileSync(join(OUT_DIR, filename), p.content, "utf8");
      return `
        <figure>
          <figcaption>
            <strong>${String(i + 1).padStart(2, "0")} · ${escape(p.heading || "(no heading)")}</strong>
            <span class="vt">${escape(vt)}${mk ? `:${escape(mk)}` : ""}</span>
            ${badge}
          </figcaption>
          <div class="panel">
            ${
              p.format === "svg"
                ? `<object data="${filename}" type="image/svg+xml" aria-label="${escape(p.heading || vt)}"></object>`
                : `<div class="html">${p.content}</div>`
            }
          </div>
          ${p.caption ? `<p class="cap">${escape(p.caption)}</p>` : ""}
        </figure>
      `;
    });
    sections.push(`
      <section class="src">
        <header>
          <h2>${escape(explainer.title)}</h2>
          <p class="meta">
            <small>${escape(target.label)} · ${escape(target.url)}</small>
            <small>${explainer.panels.length} panels · audience: ${escape(target.audience)}</small>
          </p>
        </header>
        <div class="grid">${panelRows.join("")}</div>
      </section>
    `);
  }

  const tally = Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<code>${escape(t)}</code> ×${n}`)
    .join(" · ");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Readopp panel-quality smoke test</title>
  <style>
    :root { color-scheme: light; }
    body { background: #1a1a1a; color: #FAF9F5; font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 32px; }
    h1 { font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; }
    .lead { color: #7A6F62; margin: 0 0 16px; }
    .tally { color: #D6CFC2; margin: 0 0 32px; font-size: 14px; }
    .tally code { color: #FAF9F5; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; }
    section.src { margin-bottom: 48px; }
    section.src header h2 { margin: 0; }
    section.src .meta { color: #7A6F62; margin: 4px 0 20px; display: flex; gap: 24px; flex-wrap: wrap; }
    section.src.failed .err { color: #f08c8c; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 24px; }
    figure { margin: 0; background: #2a2a2a; border-radius: 8px; overflow: hidden; }
    figcaption { padding: 12px 16px; border-bottom: 1px solid #3a3a3a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    figcaption strong { color: #FAF9F5; }
    figcaption .vt { color: #C7613D; font-size: 12px; margin-left: auto; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.06em; }
    .badge.new { background: #C7613D; color: #FAF9F5; }
    .badge.tierA { background: #455265; color: #FAF9F5; }
    .panel { background: #FAF9F5; padding: 12px; }
    .panel object { width: 100%; display: block; }
    .panel .html { color: #1a1a1a; padding: 16px; min-height: 120px; }
    .cap { color: #7A6F62; font-size: 13px; padding: 12px 16px; margin: 0; border-top: 1px solid #3a3a3a; }
  </style>
</head>
<body>
  <h1>Readopp panel-quality smoke test</h1>
  <p class="lead">Full pipeline runs against ${TARGETS.length} sources. Look for: new templates firing, no silent truncation, chrome present on every panel.</p>
  <p class="tally">visualType tally: ${tally}</p>
  ${sections.join("\n")}
</body>
</html>`;

  writeFileSync(join(OUT_DIR, "index.html"), html, "utf8");

  console.log(
    `\nWrote ${OUT_DIR}/index.html — open it to review the panels.`
  );
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
