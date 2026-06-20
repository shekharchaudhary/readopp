/**
 * Curated explainer IDs surfaced as "What others have made" cards on
 * the home page when the visitor has no explainers of their own yet.
 *
 * First-time visitors otherwise see only the hero mockup as evidence of
 * what Readopp produces — a small gallery of real, clickable explainers
 * is much stronger proof.
 *
 * Add IDs by hand after generating a polished explainer you're happy
 * to use as a public demo. The /api/explainers/samples route reads
 * them via the admin client (no RLS) so they always load regardless
 * of who owns them.
 */
export const SAMPLE_EXPLAINER_IDS: string[] = [
  // Paul Graham — Cities & Ambition
  "39b94ebb-c033-468f-8bc8-82e00bbd7134",
  // The Real AI Agent Challenge: Why Harness Beats Model
  "39d0a70b-5d7e-4686-9c80-a2440dd1a47f",
  // AI Agents Learn to Attack and Defend (Nature paper)
  "ca1f3aa1-7b98-41ee-b8fe-f3fd98db9de9",
];
