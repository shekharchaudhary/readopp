/**
 * A single curated reference panel — a real-world LinkedIn / Pinterest /
 * editorial carousel slide we want the draw model to imitate visually.
 * Stored alongside its PNG and a precomputed embedding so retrieval is
 * a cosine-similarity pass over a small in-memory array.
 */
export interface Reference {
  /** Stable kebab-case slug derived from the caption + timestamp at
   *  seed time. Used as the PNG filename: `references/<id>.png`. */
  id: string;
  /** Filename of the PNG inside the references/ directory. Always
   *  `<id>.png` in practice — kept as a separate field so the schema
   *  survives any future rename. */
  pngFile: string;
  /** The post caption / heading text the panel was paired with in the
   *  original. Used both as a retrieval signal and as context for the
   *  draw model when this reference is shown. */
  caption: string;
  /** Source genre — matches the Comprehension agent's genre output
   *  (e.g. "tech-essay", "research-paper", "news-article"). */
  genre: string;
  /** Matches PanelPlan.visualType ("structural", "flowchart",
   *  "annotated_hero", etc.). One of the strongest retrieval signals
   *  since we want layout-shape matches first. */
  visualType: string;
  /** Curator's note describing what makes this panel work — fed
   *  verbatim to the draw model so it knows WHAT to imitate, not just
   *  WHAT it looks like. Keep specific ("three-column grid, single
   *  bronze accent, strong heading hierarchy") not vague ("looks
   *  clean"). */
  whyItWorks: string;
  /** Precomputed embedding of `referenceQueryText(this)` via
   *  text-embedding-3-small (1536 dims). Frozen at seed time so
   *  retrieval doesn't hit the OpenAI API. */
  embedding: number[];
}

/**
 * Canonical query string for a Reference or a render-time query.
 * Both sides of cosine similarity must use this so corpus entries and
 * queries live in the same feature space.
 *
 * Order matters: visualType first because layout-shape match is the
 * strongest signal, then genre, then caption. The embedding model
 * weights leading tokens slightly more.
 */
export function referenceQueryText(input: {
  visualType: string;
  genre?: string;
  caption: string;
}): string {
  const parts = [
    `visualType: ${input.visualType}`,
    input.genre ? `genre: ${input.genre}` : null,
    `caption: ${input.caption}`,
  ].filter(Boolean);
  return parts.join("\n");
}
