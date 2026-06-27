/**
 * Bootstrap the reference corpus from your own past explainers.
 *
 * Two-mode CLI:
 *
 *   # Mode 1: list — rasterize every SVG panel from recent explainers,
 *   # drop them into tmp/reference-candidates/, build an HTML gallery
 *   # so you can scroll through them. Shows the seed command per panel.
 *   #
 *   #   npx tsx scripts/import-references.ts [--limit 30]
 *   #
 *   # Mode 2: seed — copy a specific candidate's PNG into the corpus,
 *   # compute its embedding, append it to references/index.json.
 *   #
 *   #   npx tsx scripts/import-references.ts seed <candidate-id> \
 *   #     --genre tech-essay \
 *   #     --why "Three-column grid, single bronze accent, strong heading hierarchy"
 *
 * Use case: you already have N explainers persisted. The ones that
 * came out *visually great* are reasonable references for the draw
 * model to imitate — same render pipeline, so the styles match. This
 * gets you a starter corpus in 10 minutes instead of curating from
 * scratch.
 *
 * Requires .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
 * OPENAI_API_KEY.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

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
    if (m[1] in process.env) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

import { embedText } from "../lib/references/embed";
import { svgToPng } from "../lib/render/rasterize";
import { corpusDir, indexFilePath, loadCorpus } from "../lib/references/store";
import { Reference, referenceQueryText } from "../lib/references/types";
import { getAdminSupabase } from "../lib/supabase/server";

const CANDIDATES_DIR = join(process.cwd(), "tmp", "reference-candidates");
const MANIFEST_FILE = join(CANDIDATES_DIR, "manifest.json");
const GALLERY_FILE = join(CANDIDATES_DIR, "index.html");

interface Candidate {
  candidateId: string;
  pngFile: string;
  caption: string;
  visualType: string;
  sourceUrl: string;
  title: string;
  /** Sniffed from the source URL to prefill the seed prompt. The user
   *  can override with --genre on the seed call. */
  guessedGenre: string;
}

// ---------------------------------------------------------------------------
// Mode 1: list
// ---------------------------------------------------------------------------

async function runList(limit: number) {
  mkdirSync(CANDIDATES_DIR, { recursive: true });

  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (admin as any)
    .from("explainers")
    .select("id, title, url, panels")
    .order("created_at", { ascending: false })
    .limit(limit)) as {
    data:
      | {
          id: string;
          title: string;
          url: string;
          panels: unknown;
        }[]
      | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error(`Supabase error: ${error.message}`);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("No explainers found.");
    return;
  }

  const candidates: Candidate[] = [];
  let scanned = 0;
  let kept = 0;
  let skippedNonSvg = 0;
  let skippedEdited = 0;
  let skippedFallback = 0;
  let skippedRasterFailed = 0;

  for (const explainer of data) {
    if (!Array.isArray(explainer.panels)) continue;
    for (const rawPanel of explainer.panels) {
      scanned++;
      const p = rawPanel as Record<string, unknown>;
      if (p.format !== "svg") {
        skippedNonSvg++;
        continue;
      }
      if (p.edited === true) {
        skippedEdited++;
        continue;
      }
      if (p.fallback === true) {
        skippedFallback++;
        continue;
      }
      const sectionId = typeof p.sectionId === "string" ? p.sectionId : "";
      const content = typeof p.content === "string" ? p.content : "";
      const caption = typeof p.caption === "string" ? p.caption : "";
      if (!sectionId || !content) continue;
      const plan = (p.plan as Record<string, unknown>) ?? {};
      const visualType =
        typeof plan.visualType === "string" ? plan.visualType : "unknown";

      const candidateId = `${explainer.id}-${sectionId}`;
      const pngFile = `${candidateId}.png`;
      try {
        const raster = svgToPng(content, { width: 800 });
        writeFileSync(join(CANDIDATES_DIR, pngFile), raster.png);
      } catch (e) {
        skippedRasterFailed++;
        console.warn(
          `rasterize failed for ${candidateId}: ${(e as Error).message}`
        );
        continue;
      }
      candidates.push({
        candidateId,
        pngFile,
        caption,
        visualType,
        sourceUrl: explainer.url,
        title: explainer.title,
        guessedGenre: guessGenre(explainer.url, explainer.title),
      });
      kept++;
    }
  }

  writeFileSync(MANIFEST_FILE, JSON.stringify(candidates, null, 2) + "\n");
  writeFileSync(GALLERY_FILE, buildGalleryHtml(candidates));

  console.log("");
  console.log(
    `Scanned ${scanned} panels across ${data.length} explainers. Wrote ${kept} candidates.`
  );
  console.log(
    `Skipped: ${skippedNonSvg} non-svg, ${skippedEdited} edited, ${skippedFallback} fallback, ${skippedRasterFailed} raster-failed.`
  );
  console.log("");
  console.log(`Gallery:  ${GALLERY_FILE}`);
  console.log(`Manifest: ${MANIFEST_FILE}`);
  console.log("");
  console.log("Open the gallery in your browser. To seed a candidate:");
  console.log("  npx tsx scripts/import-references.ts seed <candidate-id> \\");
  console.log("    --genre <genre> --why \"...\"");
}

function guessGenre(url: string, title: string): string {
  const u = url.toLowerCase();
  const t = title.toLowerCase();
  if (u.includes("arxiv.org") || /\babstract\b|\bpaper\b/.test(t))
    return "research-paper";
  if (u.includes("github.com")) return "code-repo";
  if (
    u.includes("nytimes.com") ||
    u.includes("ft.com") ||
    u.includes("reuters.com") ||
    u.includes("wsj.com") ||
    u.includes("bbc.com")
  )
    return "news-article";
  if (
    u.includes("paulgraham.com") ||
    u.includes("stratechery.com") ||
    u.includes("substack.com") ||
    u.includes("medium.com")
  )
    return "tech-essay";
  return "article";
}

function buildGalleryHtml(items: Candidate[]): string {
  const cards = items
    .map((c) => {
      const seedCmd = `npx tsx scripts/import-references.ts seed ${escapeAttr(
        c.candidateId
      )} --genre ${escapeAttr(c.guessedGenre)} --why "..."`;
      return `<article class="card">
  <div class="thumb"><img src="${escapeAttr(c.pngFile)}" alt="" loading="lazy"></div>
  <div class="meta">
    <div class="title">${escapeHtml(c.title)}</div>
    <div class="row"><span class="k">visualType</span> ${escapeHtml(c.visualType)}</div>
    <div class="row"><span class="k">guess genre</span> ${escapeHtml(c.guessedGenre)}</div>
    <div class="row"><span class="k">caption</span> ${escapeHtml(c.caption)}</div>
    <div class="row"><span class="k">source</span> <a href="${escapeAttr(c.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(c.sourceUrl)}</a></div>
    <details>
      <summary>Seed this</summary>
      <pre><code>${escapeHtml(seedCmd)}</code></pre>
    </details>
  </div>
</article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reference candidates</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #F6F4ED; color: #1A1A1A; margin: 0; padding: 32px; }
  h1 { font-weight: 500; letter-spacing: -0.02em; margin: 0 0 4px; }
  .lede { color: #6b6b6b; font-size: 13px; margin: 0 0 28px; max-width: 720px; line-height: 1.55; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; }
  .card { background: white; border: 1px solid #e8e4d8; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
  .thumb { background: white; border-bottom: 1px solid #ede9dc; }
  .thumb img { display: block; width: 100%; height: auto; }
  .meta { padding: 12px 14px; font-size: 12px; color: #1a1a1a; }
  .title { font-weight: 500; font-size: 13px; margin-bottom: 8px; line-height: 1.35; }
  .row { display: flex; gap: 6px; margin-top: 4px; line-height: 1.5; }
  .k { color: #8a8a8a; min-width: 92px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  details { margin-top: 10px; border-top: 1px dashed #ede9dc; padding-top: 8px; }
  summary { cursor: pointer; color: #6b6b6b; font-size: 12px; }
  pre { background: #1a1a1a; color: #f6f4ed; border-radius: 6px; padding: 10px 12px; font-size: 11px; overflow-x: auto; margin: 8px 0 0; user-select: all; }
  code { font-family: ui-monospace, SFMono-Regular, monospace; }
  a { color: #1a1a1a; }
</style>
</head>
<body>
<h1>Reference candidates</h1>
<p class="lede">Panels rasterized from your own past explainers. Scroll the gallery, find the ones that look great as carousels, copy the seed command from "Seed this" — edit the genre + write a one-line whyItWorks before running. Each seeded entry becomes part of the corpus the draw model will see for similar future panels.</p>
<div class="grid">
${cards}
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// ---------------------------------------------------------------------------
// Mode 2: seed
// ---------------------------------------------------------------------------

async function runSeed(argv: string[]) {
  const candidateId = argv[0];
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) return null;
    return v;
  };
  const genre = get("--genre");
  const whyItWorks = get("--why");
  const missing: string[] = [];
  if (!candidateId || candidateId.startsWith("--"))
    missing.push("<candidate-id>");
  if (!genre) missing.push("--genre");
  if (!whyItWorks) missing.push("--why");
  if (missing.length > 0) {
    console.error(`Missing required args: ${missing.join(", ")}`);
    console.error(
      'Usage: tsx scripts/import-references.ts seed <candidate-id> --genre STR --why "..."'
    );
    process.exit(1);
  }

  if (!existsSync(MANIFEST_FILE)) {
    console.error(
      `Manifest not found: ${MANIFEST_FILE}\nRun the list mode first: npx tsx scripts/import-references.ts`
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as Candidate[];
  const cand = manifest.find((c) => c.candidateId === candidateId);
  if (!cand) {
    console.error(`Candidate ${candidateId} not in manifest.`);
    process.exit(1);
  }

  const id = slugify(`${cand.caption}-${candidateId.slice(0, 8)}`);
  const pngFile = `${id}.png`;
  const src = join(CANDIDATES_DIR, cand.pngFile);
  const dest = join(corpusDir(), pngFile);
  copyFileSync(src, dest);
  console.log(`Copied ${cand.pngFile} → references/${pngFile}`);

  const queryText = referenceQueryText({
    visualType: cand.visualType,
    genre: genre!,
    caption: cand.caption,
  });
  console.log("Embedding…");
  const embedding = await embedText(queryText);

  const entry: Reference = {
    id,
    pngFile,
    caption: cand.caption,
    genre: genre!,
    visualType: cand.visualType,
    whyItWorks: whyItWorks!,
    embedding,
  };

  const existing = await loadCorpus();
  const next = existing.filter((r) => r.id !== id).concat(entry);
  writeFileSync(indexFilePath(), JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Wrote ${next.length} entr${next.length === 1 ? "y" : "ies"} to ${indexFilePath()}`
  );
  console.log(`Done · id=${id}`);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  if (sub === "seed") {
    await runSeed(argv.slice(1));
    return;
  }
  let limit = 30;
  const limitIdx = argv.indexOf("--limit");
  if (limitIdx !== -1 && argv[limitIdx + 1]) {
    const n = Number(argv[limitIdx + 1]);
    if (Number.isFinite(n) && n > 0) limit = n;
  }
  await runList(limit);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
