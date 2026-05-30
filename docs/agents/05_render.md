# Agent 5 — Render

**Job:** turn each `PanelPlan` into a clean, valid `RenderedPanel` (SVG, or self-contained HTML for tables/timelines). This is where the anti-garbling guarantee lives: real vector text, validated, self-corrected.

**Model tier:** strong.

**Input:** one `PanelPlan` (+ audienceLevel for caption tone).
Runs in parallel across panels (cap concurrency ~4).
**Output:** `RenderedPanel`

## The design system (the render agent MUST follow this)

A condensed, self-contained design system lives in `architecture/RENDERING_AND_EXPORT.md`. The render prompt embeds it. Key rules: fixed viewBox width, two font sizes, a small color palette mapped to node `group`, no overlaps, dark-mode-safe colors, sentence case, no emojis.

## System prompt (abridged — full design tokens injected from RENDERING_AND_EXPORT.md)

```
You are the render stage. Convert ONE PanelPlan into clean SVG (or self-contained HTML
for comparison tables and timelines). Output must be production-quality and follow the
embedded design system EXACTLY.

Hard rules:
- SVG: <svg viewBox="0 0 680 H" ...>. Choose H to fit content + 40px padding. Never clip.
- Two font sizes only: 14px labels, 12px subtitles/captions.
- Color encodes the node `group`. Use the provided palette. Max 3 colors per panel.
- No overlapping shapes or labels. Check every box pair: left.x+width+20 <= right.x.
- Every arrow must not cross an unrelated box; route around with an L-bend if needed.
- Sentence case everywhere. No emojis. Dark-mode-safe (use the provided CSS-variable/class system).
- For flowchart/structural: draw nodes as rounded rects, edges as arrows.
- For comparison: render a clean HTML table (format: 'html').
- For timeline: render an HTML vertical timeline (format: 'html').
- For illustrative: draw the metaphor from illustrativeBrief as SVG primitives (paths, circles, rects).
- For stat_callout: one big number + label, SVG.

After drafting, SELF-VALIDATE against the checklist (below). If any check fails, fix and re-emit.
Respond with ONLY the SVG or HTML string. No fences, no commentary.
```

## Self-validation checklist (the agent runs this on its own output before returning)

1. Valid, well-formed XML/HTML (parses).
2. All content within the viewBox (no negative coords, nothing past width 680 or below H-40).
3. No two unrelated boxes overlap; ≥20px horizontal gap between same-row boxes.
4. No arrow line passes through a box it doesn't connect.
5. Text fits its container (label chars × 8 + padding ≤ box width).
6. Only the two allowed font sizes used.
7. Colors come from the allowed palette; ≤3 used.

## Programmatic validation (orchestrator side, after the agent returns)

Belt-and-suspenders. The orchestrator additionally:
- Parses the SVG/HTML (fail = retry).
- Runs a lightweight bounding-box overlap check for `<rect>` elements (best-effort).
- If invalid after 2 agent retries → emit the **fallback panel**: a simple titled card containing the caption text and the section heading, marked `fallback: true`. The explainer is never broken by one bad panel.

## Emits

- `panel.start` { sectionId, index, total } before each panel.
- `panel.done` { panel, index, total } when each finishes → this is what makes panels appear one-by-one in the UI.
