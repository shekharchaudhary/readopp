/**
 * Design-system tokens embedded into the render prompt and reused by the
 * panel-card on the client. Source of truth for SVG diagram constraints.
 * See docs/architecture/RENDERING_AND_EXPORT.md.
 */

export const DESIGN_SYSTEM_PROMPT = `
DESIGN SYSTEM — these rules are HARD CONSTRAINTS. Output that violates any of
them will be rejected. Aim for editorial-quality diagrams: lots of whitespace,
calm restraint, professional-tool feel (think Linear / Stripe documentation,
not a marketing slide).

═══════════════════════════════════════════════════════════════════════════
CANVAS
═══════════════════════════════════════════════════════════════════════════
• Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 H" role="img"
  font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>…</title><desc>…</desc>…</svg>
• Width is ALWAYS 680. H = whatever the content needs + 40px bottom padding.
• Safe area: every visible element must sit within x ∈ [40, 640] and
  y ∈ [40, H − 40]. No negative coords, nothing past width 680.
• Background: leave transparent (the page paper shows through). Do NOT add
  a full-canvas <rect> as background.

═══════════════════════════════════════════════════════════════════════════
GRID + ALIGNMENT
═══════════════════════════════════════════════════════════════════════════
• Snap every x, y, width, height to a multiple of 4. (Coordinates ending
  in .5 are forbidden; round.)
• Nodes in the same row MUST share a y. Nodes in the same column MUST
  share an x. No "almost aligned" 2-3px drift.
• Horizontal centerline of an N-node row is x=340. Distribute symmetrically
  around it: e.g. for 3 nodes width 160 with 40px gap, x values are 80, 260, 440.

═══════════════════════════════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════════════════════════════
• Allowed sizes: 14 (labels, headings inside diagrams) and 12 (subtitles,
  captions, edge labels, axis text). EXCEPTION: stat_callout's hero number
  may be 56.
• Allowed weights: 400 (regular) and 500 (medium). Never 600/700/bold.
• Sentence case throughout. No ALL CAPS. No Title Case. No emojis. No
  icon fonts. No italics (font-style: italic forbidden).
• Line-height: every multi-line <text> uses dy="18" between <tspan>s for
  14px text, dy="16" for 12px.
• Label length budget: a node label ≤ 28 chars. If longer, the planner
  should have split it; if you receive a long one, truncate at 25 chars
  with an ellipsis (one Unicode … char, not three dots).
• Text colour comes from the chosen palette's text shade. NEVER use #000
  or pure black for text on a colored fill.

═══════════════════════════════════════════════════════════════════════════
COLOUR — pick AT MOST 2 palettes per panel from this list
═══════════════════════════════════════════════════════════════════════════
• blue    fill #E6F1FB  stroke #185FA5  text #0C447C
• teal    fill #E1F5EE  stroke #0F6E56  text #085041
• amber   fill #FAEEDA  stroke #854F0B  text #633806
• purple  fill #EEEDFE  stroke #534AB7  text #3C3489
• gray    fill #F1EFE8  stroke #5F5E5A  text #2C2C2A

Rules:
• Pick ONE primary palette for the panel's main subject. Gray counts as
  the "neutral" palette and may always be added as a second.
• "Highlight" / start / end nodes use the second non-gray palette if any;
  otherwise the primary palette at full strength.
• Same group → identical palette. No off-spec hex values.
• Connector strokes use #6B6B6B (gray-stroke at 70% opacity) UNLESS the
  connector is THE focal point of the panel — then it adopts the primary
  palette's stroke colour.

═══════════════════════════════════════════════════════════════════════════
NODES (rounded rects)
═══════════════════════════════════════════════════════════════════════════
• Shape: <rect rx="8" ry="8" stroke-width="1">
• Inner padding: 16px left/right, 12px top/bottom.
• Single-line node height: 44px. Two-line node height: 64px. Three+ lines
  forbidden — re-phrase or split into two nodes.
• Default node widths: 160 (compact), 200 (standard), 240 (wide). Pick the
  smallest that fits the label.
• A node's <text> anchor sits at the rect's geometric center
  (x = rect.x + rect.width/2, y = rect.y + rect.height/2 + 5), with
  text-anchor="middle" and dominant-baseline="middle".

═══════════════════════════════════════════════════════════════════════════
SPACING
═══════════════════════════════════════════════════════════════════════════
• Minimum horizontal gap between same-row nodes: 32px.
• Minimum vertical gap between rows of nodes: 56px.
• Connector arrow tip stops 6px short of the destination rect's edge
  (avoid touching the border).
• Section heading above a group of nodes: 12px text at y = group.top − 20.

═══════════════════════════════════════════════════════════════════════════
CONNECTORS (arrows / edges)
═══════════════════════════════════════════════════════════════════════════
• Always define ONE marker in <defs>:
  <defs>
    <marker id="chev" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0 0 L10 5 L0 10" fill="none" stroke="currentColor" stroke-width="1"/>
    </marker>
  </defs>
• Every connector: <path fill="none" stroke="#6B6B6B" stroke-width="1"
  marker-end="url(#chev)" d="…" stroke-linecap="round" stroke-linejoin="round"/>
• Routing: ONLY straight lines (M x1 y1 L x2 y2) OR perfect L-bends
  (M x1 y1 L mx y1 L mx y2 L x2 y2). No diagonals through unrelated boxes.
  No curves (Q/C) for connectors.
• Edge label (if any): <text font-size="12"> placed at the midpoint of the
  longest segment, with a 4px white halo via <text> doubled (stroke=#fafaf7
  stroke-width=4 first, then the real one) so it reads over the line.

═══════════════════════════════════════════════════════════════════════════
PER VISUAL TYPE
═══════════════════════════════════════════════════════════════════════════
• flowchart: ONE of (a) vertical chain: nodes stacked, x-centered at 340,
  56px vertical gap between rects; (b) horizontal sequence: row of 3–5
  nodes at y=center, 32px gap; (c) shallow tree: max 2 levels. Pick the
  layout that fits the edges; do not mix.

• structural: a 600×(H−80) outer container rect (rx=10, palette fill
  + 1px stroke) at (40, 40), with named sub-regions inside (different
  palette tint, 24px inset). Inner items are smaller rounded rects (rx=6).
  No connectors between regions; structure communicates itself.

• comparison: emit HTML (format: "html"). See HTML TABLE rules below.

• timeline: emit HTML (format: "html"). See HTML TIMELINE rules below.

• illustrative: 1–3 freeform shapes (paths/polygons) drawing the metaphor.
  Labels OUTSIDE the shapes connected by thin 1px leader lines
  (stroke="#a3a3a3"). No text inside organic shapes.

• stat_callout: ONE big number, font-size=56, font-weight=500, fill =
  primary palette stroke shade, centered at x=340 y≈H/2. A 12px label
  beneath it (y = number_y + 36), max 8 words, fill=#3a3a3a. Optionally
  a thin horizontal accent line above the number (x=300..380, stroke =
  palette stroke, stroke-width=1).

═══════════════════════════════════════════════════════════════════════════
HTML PANELS (comparison / timeline only)
═══════════════════════════════════════════════════════════════════════════
• Single self-contained block. No <html>/<head>/<body> wrapper — just
  the root <div>. Inline styles only. Use only the colours above plus
  these neutrals: #fafaf7 paper, #1a1a1a ink, #3a3a3a ink-soft,
  #6b6b6b ink-muted, #e3e1d8 paper-line, #f1efe8 paper-soft.
• Root div MUST start with: style="font-family: ui-sans-serif, system-ui,
  -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#1a1a1a;
  font-size:14px; line-height:1.5;"

TABLE (comparison):
• <table style="width:100%; border-collapse:collapse;">
• <thead><tr style="background:#f1efe8;"> with <th style="padding:10px 12px;
  text-align:left; font-weight:500; font-size:12px; color:#3a3a3a;
  text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #e3e1d8;">
• <tbody> rows with <tr> alternating background (none / #fafaf7).
  <td style="padding:10px 12px; font-size:14px; vertical-align:top;
  border-bottom:1px solid #e3e1d8;"> for body, label cell uses font-weight:500.
• Max 6 rows, max 4 columns. Cell text ≤ 50 chars; truncate with … if longer.

TIMELINE (vertical):
• Outer <div> with relative positioning + left padding 28px.
• Vertical 1px line at left:11px from top to bottom (#e3e1d8).
• Each entry: <div style="position:relative; padding-bottom:20px;">
    – Dot: 9px circle at position absolute left:-22px top:6px, background
      uses palette stroke, border:2px solid #fafaf7.
    – When (date / phase): 12px, color #6b6b6b, font-weight:500.
    – What (description): 14px, color #1a1a1a, margin-top:2px.
• Max 6 entries.

═══════════════════════════════════════════════════════════════════════════
NEVER USE
═══════════════════════════════════════════════════════════════════════════
• <script>, <foreignObject>, external references (href="http…").
• filter, mask, clip-path, pattern, gradient.
• box-shadow, drop-shadow, blur, opacity < 1 (markers excepted).
• Emojis, icon fonts, raster images, &lt;img&gt;.
• Comments (<!-- ... -->) — strip them.

═══════════════════════════════════════════════════════════════════════════
SELF-CHECK before returning (silent — do not include the checklist):
═══════════════════════════════════════════════════════════════════════════
1) Parses as valid SVG/HTML.
2) Every coord within the safe area, snapped to /4.
3) No two unrelated rects overlap; gaps respect minimums.
4) Every connector has marker-end="url(#chev)" and L-bend or straight only.
5) Every <text> uses font-size 12 or 14 (56 allowed only for stat_callout
   hero number) and weight 400 or 500.
6) Colours are all from the palette + neutrals.
7) Same-group nodes share palette and y (or x for columns).
8) Labels are sentence case, ≤ 28 chars, no ellipsis-mid-word.
9) <title> and <desc> are present and non-empty.
If any check fails, fix BEFORE returning — don't ship a defective panel.
`.trim();
