/**
 * Design-system tokens embedded into the render prompt and reused by the
 * panel-card on the client. Source of truth for SVG diagram constraints.
 * See docs/architecture/RENDERING_AND_EXPORT.md.
 */

export const DESIGN_SYSTEM_PROMPT = `
SVG DESIGN SYSTEM (follow exactly):

CANVAS
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 H" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"><title>...</title><desc>...</desc>...</svg>
- Width is fixed at 680. H is whatever fits content + 40px bottom padding.
- Safe area: x in [40, 640], y in [40, H - 40]. No negative coordinates. Nothing past width 680.

TYPOGRAPHY
- Two sizes only: 14px (labels/headings), 12px (subtitles/captions/edge labels).
- Two weights only: 400 (regular), 500 (medium). Never 600/700.
- Sentence case everywhere. No ALL CAPS, no Title Case. No emojis. No icon fonts.

COLOR (light-locked palette — pick at most 3 of these per panel; gray = neutral)
- blue    fill #E6F1FB  stroke #185FA5  text #0C447C
- teal    fill #E1F5EE  stroke #0F6E56  text #085041
- amber   fill #FAEEDA  stroke #854F0B  text #633806
- purple  fill #EEEDFE  stroke #534AB7  text #3C3489
- gray    fill #F1EFE8  stroke #5F5E5A  text #2C2C2A
Map node "group" to one color. Same group => same color.
Never put black text on a colored fill — use the dark text from the same ramp.

SHAPES & LAYOUT
- Nodes: rounded rects, rx=8. Single-line ~44px tall; two-line ~56px. 24px inner padding.
- Min 60px between row stacks; min 20px horizontal gap between same-row boxes.
- Stroke widths: 1px on node borders, 1px on arrows.
- Arrows: thin, with an open chevron marker. fill="none" on connector <path>s.
- Define one <marker id="chev" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="none" stroke="currentColor" stroke-width="1"/></marker>
- Use L-bends to route around boxes; never let an arrow pass through an unrelated box.
- Max 3-6 nodes per panel. If the plan has more, render the most important and note in caption.

PER-VISUAL-TYPE
- flowchart: top-down or left-right, single direction.
- structural: large container rect with nested region rects (different ramps for nested regions).
- comparison: emit HTML (format: "html") — a clean table, header row shaded, alt row fills, no heavy borders.
- timeline: emit HTML (format: "html") — vertical timeline, dots + lines + entries.
- illustrative: freeform SVG primitives drawing the metaphor; labels outside the drawing with thin leader lines.
- stat_callout: one big number (exception: up to 48px) + a 12-14px label, SVG.

HTML PANELS (only for comparison/timeline)
- Single self-contained block. No <html>/<head>/<body> wrapper — just the root <div>.
- Inline styles only (no <style> tags, no external CSS). Use only the colors above.
- Root div MUST have style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#1a1a1a; font-size:14px; line-height:1.4;"

SELF-VALIDATE before returning (silently — do not write the checklist):
1) Well-formed XML/HTML, parses.
2) Every coordinate within the viewBox.
3) No two unrelated boxes overlap; >=20px horizontal gap between same-row boxes.
4) No arrow passes through a box it doesn't connect.
5) Label chars * 8 + padding <= box width.
6) Only the two allowed font sizes used.
7) At most 3 colors from the palette.
If any check fails, fix it before returning.
`.trim();
