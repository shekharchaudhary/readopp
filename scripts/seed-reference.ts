/**
 * Seed one entry into the reference corpus.
 *
 *   npx tsx scripts/seed-reference.ts \
 *     --png ~/Downloads/great-panel.png \
 *     --caption "Three forces shaping the AI market" \
 *     --genre tech-essay \
 *     --visualType structural \
 *     --why "Three-column grid, single bronze accent, strong heading hierarchy"
 *
 * What it does:
 *   1. Reads the source PNG.
 *   2. Generates a stable id (slug of caption + date).
 *   3. Copies the PNG to references/<id>.png.
 *   4. Embeds the canonical query text via OpenAI text-embedding-3-small.
 *   5. Appends a Reference row to references/index.json.
 *
 * Requires OPENAI_API_KEY in .env.local. Re-run any time you find a
 * panel worth imitating — the live render path picks up the new entry
 * on next worker boot (or set RESET_CORPUS_CACHE=1 to force-reload
 * mid-process in dev).
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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

import { embedText } from "../lib/references/embed";
import { corpusDir, indexFilePath, loadCorpus } from "../lib/references/store";
import { Reference, referenceQueryText } from "../lib/references/types";

interface Args {
  png: string;
  caption: string;
  genre: string;
  visualType: string;
  whyItWorks: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) return null;
    return v;
  };
  const png = get("--png");
  const caption = get("--caption");
  const genre = get("--genre");
  const visualType = get("--visualType");
  const whyItWorks = get("--why");
  const missing: string[] = [];
  if (!png) missing.push("--png");
  if (!caption) missing.push("--caption");
  if (!genre) missing.push("--genre");
  if (!visualType) missing.push("--visualType");
  if (!whyItWorks) missing.push("--why");
  if (missing.length > 0) {
    console.error(`Missing required flags: ${missing.join(", ")}`);
    console.error(
      "Usage: tsx scripts/seed-reference.ts --png FILE --caption STR --genre STR --visualType STR --why STR"
    );
    process.exit(1);
  }
  return {
    png: png!,
    caption: caption!,
    genre: genre!,
    visualType: visualType!,
    whyItWorks: whyItWorks!,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  const args = parseArgs();
  if (!existsSync(args.png)) {
    console.error(`PNG not found: ${args.png}`);
    process.exit(1);
  }

  const datePart = new Date().toISOString().slice(0, 10);
  const id = `${slugify(args.caption)}-${datePart}`;
  const pngFile = `${id}.png`;
  const dest = join(corpusDir(), pngFile);
  copyFileSync(args.png, dest);
  console.log(`Copied ${basename(args.png)} → references/${pngFile}`);

  // Match the live retrieval query exactly — corpus and queries must
  // sit in the same feature space.
  const queryText = referenceQueryText({
    visualType: args.visualType,
    genre: args.genre,
    caption: args.caption,
  });
  console.log("Embedding…");
  const embedding = await embedText(queryText);

  const entry: Reference = {
    id,
    pngFile,
    caption: args.caption,
    genre: args.genre,
    visualType: args.visualType,
    whyItWorks: args.whyItWorks,
    embedding,
  };

  const existing = await loadCorpus();
  // Replace if id collision (same caption seeded same day) instead of
  // duplicating. Caller can manually delete the old PNG if they care.
  const next = existing.filter((r) => r.id !== id).concat(entry);
  writeFileSync(indexFilePath(), JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Wrote ${next.length} entr${next.length === 1 ? "y" : "ies"} to ${indexFilePath()}`
  );
  console.log(`Done · id=${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
