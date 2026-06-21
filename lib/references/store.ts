import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cosineSim, EMBEDDING_DIMS, embedText } from "./embed";
import { Reference, referenceQueryText } from "./types";

const CORPUS_DIR = join(process.cwd(), "references");
const INDEX_FILE = join(CORPUS_DIR, "index.json");

/**
 * In-memory copy of references/index.json. Loaded once per process and
 * reused across every render. Promise-typed cache so concurrent first
 * callers share a single disk read. `null` means "not yet attempted";
 * `[]` means "loaded and empty" (no corpus yet, or load failed).
 */
let _corpus: Promise<Reference[]> | null = null;

export function corpusDir(): string {
  return CORPUS_DIR;
}

export function indexFilePath(): string {
  return INDEX_FILE;
}

async function loadCorpusFromDisk(): Promise<Reference[]> {
  let raw: string;
  try {
    raw = await readFile(INDEX_FILE, "utf8");
  } catch {
    // No corpus yet — fresh install or pre-seed state. Silent so the
    // render path doesn't log spam every panel.
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(
      `[readopp] references/index.json is not valid JSON; ignoring corpus: ${(e as Error).message}`
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn("[readopp] references/index.json is not an array; ignoring");
    return [];
  }
  const out: Reference[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (
      typeof e.id !== "string" ||
      typeof e.pngFile !== "string" ||
      typeof e.caption !== "string" ||
      typeof e.genre !== "string" ||
      typeof e.visualType !== "string" ||
      typeof e.whyItWorks !== "string" ||
      !Array.isArray(e.embedding) ||
      e.embedding.length !== EMBEDDING_DIMS ||
      !e.embedding.every((n) => typeof n === "number")
    ) {
      console.warn(
        `[readopp] skipping malformed reference entry: ${
          typeof e.id === "string" ? e.id : "<no id>"
        }`
      );
      continue;
    }
    out.push({
      id: e.id,
      pngFile: e.pngFile,
      caption: e.caption,
      genre: e.genre,
      visualType: e.visualType,
      whyItWorks: e.whyItWorks,
      embedding: e.embedding as number[],
    });
  }
  return out;
}

export function loadCorpus(): Promise<Reference[]> {
  if (!_corpus) _corpus = loadCorpusFromDisk();
  return _corpus;
}

/**
 * Drop the in-memory cache. Used by the seed-reference CLI after it
 * writes a new entry so a re-run in the same process picks it up.
 * Production never calls this — the cache lives for the worker's life.
 */
export function resetCorpusCache(): void {
  _corpus = null;
}

export interface RetrievalHit {
  reference: Reference;
  score: number;
}

/**
 * Top-k most similar references to the query. Loads the corpus if
 * needed, embeds the query text, ranks by cosine similarity, returns
 * the top k entries above `minScore`.
 *
 * If the corpus is empty, returns `[]` — never throws. Callers should
 * treat an empty result as "no RAG injection this render."
 */
export async function findRelevant(
  query: { visualType: string; genre?: string; caption: string },
  opts: { k?: number; minScore?: number } = {}
): Promise<RetrievalHit[]> {
  const corpus = await loadCorpus();
  if (corpus.length === 0) return [];
  const k = opts.k ?? 3;
  // 0.2 is loose enough to surface plausible matches in a tiny corpus
  // without showering the model with irrelevant ones. Tighten as the
  // corpus grows past ~50 entries.
  const minScore = opts.minScore ?? 0.2;

  const queryEmbed = await embedText(referenceQueryText(query));
  const scored: RetrievalHit[] = corpus.map((r) => ({
    reference: r,
    score: cosineSim(queryEmbed, r.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score >= minScore).slice(0, k);
}
