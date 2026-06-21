import OpenAI from "openai";

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Reference-RAG needs it for the embedding API. " +
        "Either add it to .env.local or unset READOPP_REFERENCE_RAG to disable RAG."
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Dimension of text-embedding-3-small. Hard-coded so we can validate
 *  corpus rows on load and reject ones from a different model. */
export const EMBEDDING_DIMS = 1536;

/**
 * Embed a single string. Used both at seed time (to materialize the
 * corpus embeddings) and at render time (to embed the query for
 * cosine retrieval).
 *
 * Cost: ~$0.00002 per call for typical short queries (≈ 5 cents per
 * 10,000 panels). Effectively free.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Unexpected embedding shape: got ${vec?.length ?? 0} dims, expected ${EMBEDDING_DIMS}`
    );
  }
  return vec;
}

/**
 * Cosine similarity between two equal-length vectors. Returns a value
 * in [-1, 1]; for OpenAI embeddings it's effectively [0, 1].
 *
 * Plain JS rather than a vector library — the corpus is small (≤200)
 * and we score it once per render, so a microbenchmark difference
 * doesn't matter.
 */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
