# Rendering & Export

Two responsibilities: (1) the design system the render agent follows, and (2) turning panels into social-ready PNGs.

## Part 1 — Design system (embedded into the render agent prompt)

### Canvas
- SVG root: `<svg width="100%" viewBox="0 0 680 H" role="img"><title>…</title><desc>…</desc>…`
- 680 width is fixed (load-bearing). Height H fits content + 40px bottom padding.
- Safe area: x in [40, 640], y in [40, H-40]. No negative coordinates.

### Typography
- Two sizes only: 14px (labels/headings), 12px (subtitles/captions/arrow labels).
- Two weights only: 400 regular, 500 medium. Never 600/700.
- Sentence case everywhere. No ALL CAPS, no Title Case. No emojis.

### Color (map to PanelNode.group)
A small palette; each `group` gets one color; max 3 colors per panel; gray for neutral/start/end.
Use a class-per-color system so dark mode works automatically. Light mode: light fill + mid stroke + dark text from the same family. Dark mode: dark fill + light text. Never put black text on a colored fill — use the dark shade of the same hue.

Suggested ramps (light fill / stroke / text):
- blue   #E6F1FB / #185FA5 / #0C447C
- teal   #E1F5EE / #0F6E56 / #085041
- amber  #FAEEDA / #854F0B / #633806
- purple #EEEDFE / #534AB7 / #3C3489
- gray   #F1EFE8 / #5F5E5A / #2C2C2A   (neutral/structural)

For PNG export we also generate a **light-locked** variant (see Part 2) so social images don't depend on the viewer's dark mode.

### Shapes & layout
- Nodes: rounded rects, rx=8. Single-line node ~44px tall; two-line ~56px.
- ≥60px between boxes; ≥20px horizontal gap between same-row boxes; 24px inner padding.
- Arrows: thin (0.5–1.5px), open chevron head via a `<marker>`. Never cross unrelated boxes — use L-bends.
- Connector `<path>`s must have `fill="none"`.
- Max 3–6 nodes per panel. If the plan has more, the planner failed — render the most important ones and note in caption.

### Per-visual-type rendering
- flowchart: top-down or left-right single direction.
- structural: large container rect with nested region rects (different ramps for nested regions).
- comparison: HTML table (format 'html'), header row shaded, alternating row fills, no heavy borders.
- timeline: HTML vertical timeline, dots + lines + entries.
- illustrative: freeform SVG primitives drawing the metaphor from `illustrativeBrief`; color encodes intensity/state; labels outside the drawing with thin leader lines.
- stat_callout: one large number (still ≤ the size system? — exception: a single hero number may be up to 48px) + a 12–14px label.

> Reuse note: this is the same family of rules used to produce the demo diagrams the founder already saw render cleanly. Keep them strict — they are why output doesn't look AI-garbled.

## Part 2 — Social export pipeline

### Formats
```
square    1080×1080  Instagram feed
vertical  1080×1920  TikTok / Reels / Stories
landscape 1200×627   LinkedIn
```

### How export works (server-side, deterministic)
1. Client calls `POST /api/explainers/:id/export { panelId?, format }`.
2. Server builds an HTML export document:
   - A fixed-size container at the target dimensions (e.g. 1080×1080).
   - **Light-locked** theme (force the light palette; ignore dark mode).
   - Branding frame: app wordmark + the article source domain + (v2) user logo.
   - Title + the panel's SVG/HTML, scaled to fit with comfortable margins.
   - For whole-explainer export, stack panels and paginate: square/landscape → one panel per image returned as a set; vertical → can stack 2–3 panels since it's tall.
3. Server uses **Playwright** (headless Chromium) to load that HTML at exact device pixel ratio and screenshot to PNG.
4. Upload PNG to object storage; return `ExportResult { url, format, width, height }`.

### Why Playwright, not an SVG→PNG library
The panels can be SVG *or* HTML (tables/timelines). A headless browser renders both identically to what the user saw, with correct fonts. Pure SVG rasterizers choke on HTML panels and on web fonts. One renderer for both = consistency.

### Layout per format
- **square (1080²):** centered panel, title top, source/wordmark bottom. Generous padding (~80px).
- **vertical (1080×1920):** title block top third, panel(s) center, CTA/source bottom. Big text — designed to be readable on a phone at thumb distance.
- **landscape (1200×627):** title left or top, panel right/center; denser, LinkedIn-appropriate.

### Fonts in export
Bundle the web font in the export HTML (self-hosted woff2) so screenshots are deterministic and don't depend on network/Google Fonts availability.

### Caching exports
Key exports by `(explainerId, panelId, format)`. Same request returns the stored PNG.

### v2 (do not build now)
- Branded exports (user logo + brand color injected into the export theme).
- MP4 reel export: render each panel as a frame/scene, animate transitions with a timeline (e.g. Remotion), stitch to video for TikTok/Reels.
