# Agent 6 — Assembly

**Job:** combine the rendered panels and comprehension into the final `Explainer` artifact. Mostly deterministic; a tiny LLM touch only to write a smooth title/summary if needed.

**Model tier:** fast (or no LLM at all — can be pure code).

**Input:** all `RenderedPanel`s + `Comprehension` + `ExplainerOutline`.
**Output:** `Explainer` (see DATA_CONTRACTS.md)

## Procedure

1. Order panels by the outline's section order.
2. Title = `ExplainerOutline.title`. Summary = `Comprehension.oneLineSummary`.
3. Assemble the `Explainer` object, persist it, set `Job.explainerId`, set status `completed`.
4. Emit `agent.done` then `job.completed { explainer }`.

## Optional LLM polish

If the title or summary reads awkwardly, one fast-model call may refine them:

> Rewrite this explainer title to be clear and punchy (<= 70 chars) and this summary to be one plain sentence (<= 140 chars). Keep it accurate to the content. Return JSON { title, summary }.

Skip this call if the existing title/summary are already clean — it's a nicety, not required.

## Note

No new information is invented here. Assembly only orders and packages what earlier agents produced.
