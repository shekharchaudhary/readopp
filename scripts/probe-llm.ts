/**
 * Minimal probe: does a single MODEL_STRONG call complete outside Next?
 * Run: npx tsx scripts/probe-llm.ts
 */
import { callMessages, MODEL_STRONG, cachedSystem } from "../lib/anthropic";

async function main() {
  const t = Date.now();
  console.log("calling", MODEL_STRONG, "…");
  const res = await callMessages(
    {
      model: MODEL_STRONG,
      max_tokens: 64,
      system: cachedSystem("You are a terse assistant."),
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    },
    { label: "probe" }
  );
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  console.log(`done in ${Date.now() - t}ms ->`, JSON.stringify(text));
}
main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
