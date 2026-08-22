import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type { RenderedPanel } from "../shared/schemas";
import type { AttributionRenderInput, PanelRenderInput, TemplateDef } from "./types";

/**
 * Swiss Social is one adaptive publishing system, not a set of decorative
 * themes. It reads the structured panel plan and gives each slide a job.
 */
const PAPER = "#F3F0E8";
const INK = "#151515";
const MUTED = "#66635D";
const RULE = "#C9C4B8";
const DEFAULT_ACCENT = "#E23B25";
const FONT = "'Neue Haas Grotesk', 'Helvetica Now Display', 'Inter', Helvetica, Arial, sans-serif";

interface Sizes { pad: number; meta: number; headline: number; body: number; display: number; gap: number; }

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  if (format === "vertical") return { pad: 72, meta: 21, headline: 92, body: 32, display: 172, gap: 34 };
  if (format === "landscape") return { pad: 42, meta: 13, headline: 48, body: 19, display: 88, gap: 18 };
  return { pad: 58, meta: 17, headline: 68, body: 27, display: 132, gap: 26 };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function headlineScale(length: number): number {
  if (length <= 28) return 1;
  if (length <= 48) return 0.84;
  if (length <= 72) return 0.7;
  return 0.59;
}

function accentFor(input: PanelRenderInput | AttributionRenderInput): string {
  return input.brand?.color ?? DEFAULT_ACCENT;
}

function renderFindings(panel: RenderedPanel): string | null {
  const findings = panel.plan?.keyFindings?.findings;
  if (!findings?.length) return null;
  return `<section class="finding-list" aria-label="Key findings">${findings.slice(0, 4).map((finding, index) => `<article class="finding"><span class="finding-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(finding.title)}</strong>${finding.detail ? `<p>${escapeHtml(finding.detail)}</p>` : ""}</div>${finding.figure ? `<b>${escapeHtml(finding.figure)}</b>` : ""}</article>`).join("")}</section>`;
}

function renderFramework(panel: RenderedPanel): string | null {
  const framework = panel.plan?.framework;
  if (!framework?.steps.length) return null;
  return `<section class="framework" aria-label="${escapeHtml(framework.label ?? "Framework")}">${framework.steps.slice(0, 6).map((step, index) => `<article class="framework-step"><span>${index + 1}</span><div><strong>${escapeHtml(step.name)}</strong>${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}</div></article>`).join("")}</section>`;
}

function renderChart(panel: RenderedPanel): string | null {
  const chart = panel.plan?.chart;
  const points = chart?.series[0]?.points.slice(0, 6);
  if (!chart || !points?.length) return null;
  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  return `<section class="bars" aria-label="${escapeHtml(chart.title ?? "Chart")}">${points.map((point) => `<div class="bar-row"><span>${escapeHtml(point.label)}</span><i><em style="width:${Math.max(4, Math.round((Math.abs(point.value) / max) * 100))}%"></em></i><strong>${escapeHtml(`${point.value}${chart.unit ?? ""}`)}</strong></div>`).join("")}</section>`;
}

function renderComparison(panel: RenderedPanel): string | null {
  const beforeAfter = panel.plan?.beforeAfter;
  if (beforeAfter) return `<section class="split" aria-label="Before and after"><article><span>Before</span><strong>${escapeHtml(beforeAfter.before.label)}</strong>${beforeAfter.before.description ? `<p>${escapeHtml(beforeAfter.before.description)}</p>` : ""}</article><b>${escapeHtml(beforeAfter.transition ?? "→")}</b><article class="after"><span>After</span><strong>${escapeHtml(beforeAfter.after.label)}</strong>${beforeAfter.after.description ? `<p>${escapeHtml(beforeAfter.after.description)}</p>` : ""}</article></section>`;
  const comparison = panel.plan?.comparison;
  if (!comparison?.columns.length) return null;
  return `<section class="comparison" aria-label="Comparison">${comparison.columns.slice(0, 3).map((column, columnIndex) => `<article><strong>${escapeHtml(column)}</strong>${comparison.rows.slice(0, 4).map((row) => `<p><span>${escapeHtml(row.label)}</span>${escapeHtml(row.cells[columnIndex] ?? "—")}</p>`).join("")}</article>`).join("")}</section>`;
}

function renderTimeline(panel: RenderedPanel): string | null {
  const timeline = panel.plan?.timeline;
  if (!timeline?.length) return null;
  return `<section class="timeline" aria-label="Timeline">${timeline.slice(0, 6).map((item) => `<article><span>${escapeHtml(item.when)}</span><strong>${escapeHtml(item.what)}</strong></article>`).join("")}</section>`;
}

function contentFor(panel: RenderedPanel): { mode: string; html: string } {
  const plan = panel.plan;
  if (plan?.stat?.value) return { mode: "stat-mode", html: `<section class="stat"><strong>${escapeHtml(plan.stat.value)}</strong><p>${escapeHtml(plan.stat.label)}</p></section>` };
  if (plan?.quoteCard?.text) {
    const meta = [plan.quoteCard.attribution, plan.quoteCard.context].filter(Boolean).join(" · ");
    return { mode: "quote-mode", html: `<blockquote><span>“</span>${escapeHtml(plan.quoteCard.text)}${meta ? `<cite>${escapeHtml(meta)}</cite>` : ""}</blockquote>` };
  }
  if (plan?.insight?.text) return { mode: "insight-mode", html: `<section class="insight"><p>${escapeHtml(plan.insight.text)}</p>${plan.insight.attribution ? `<span>${escapeHtml(plan.insight.attribution)}</span>` : ""}</section>` };
  const findings = renderFindings(panel);
  if (findings) return { mode: "findings-mode", html: findings };
  const framework = renderFramework(panel);
  if (framework) return { mode: "framework-mode", html: framework };
  if (plan?.definitionCard) {
    const item = plan.definitionCard;
    return { mode: "definition-mode", html: `<section class="definition"><strong>${escapeHtml(item.term)}</strong><p>${escapeHtml(item.definition)}</p>${item.analogy ? `<aside>Think of it like: ${escapeHtml(item.analogy)}</aside>` : ""}</section>` };
  }
  const comparison = renderComparison(panel);
  if (comparison) return { mode: "comparison-mode", html: comparison };
  const chart = renderChart(panel);
  if (chart) return { mode: "chart-mode", html: chart };
  const timeline = renderTimeline(panel);
  if (timeline) return { mode: "timeline-mode", html: timeline };
  if (panel.content?.trim()) {
    const visual = panel.format === "html" ? `<div class="html-visual">${panel.content}</div>` : panel.content;
    return { mode: "visual-mode", html: `<section class="visual-wrap">${visual}</section>` };
  }
  return { mode: "text-mode", html: panel.caption ? `<p class="body-copy">${escapeHtml(panel.caption)}</p>` : "" };
}

function baseCss(w: number, h: number, S: Sizes, accent: string, scale = 1, landscape = false): string {
  const cols = landscape ? "minmax(0,.86fr) minmax(0,1.14fr)" : "1fr";
  return `
  *,*::before,*::after{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${PAPER};color:${INK};font-family:${FONT}}
  .page{position:relative;width:${w}px;height:${h}px;padding:${S.pad}px;display:flex;flex-direction:column;background:${PAPER};overflow:hidden}
  .page::before{content:"";position:absolute;inset:${S.pad}px;background-image:linear-gradient(90deg,rgba(21,21,21,.055) 1px,transparent 1px);background-size:calc(100% / 6) 100%;pointer-events:none}
  .top,.main,.footer{position:relative;z-index:1}.top{display:flex;justify-content:space-between;gap:24px;padding-bottom:${Math.round(S.gap * .7)}px;border-bottom:2px solid ${INK};font-size:${S.meta}px;font-weight:650}
  .top .source{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72%}.top .index{color:${accent};font-variant-numeric:tabular-nums}
  .main{flex:1;min-height:0;display:grid;grid-template-columns:${cols};gap:${S.gap * 1.35}px;padding:${S.gap}px 0;align-items:stretch;overflow:hidden}.story{min-width:0;display:flex;flex-direction:column;justify-content:space-between}
  .kicker{margin:0 0 ${Math.round(S.gap * .55)}px;color:${accent};font-size:${S.meta}px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}h1{margin:0;max-width:98%;font-size:${Math.round(S.headline * scale)}px;line-height:.98;letter-spacing:-.052em;font-weight:760;text-wrap:balance}
  .caption{margin:${S.gap}px 0 0;max-width:90%;font-size:${S.body}px;line-height:1.36;color:${MUTED}}.content{min-height:0;display:flex;align-items:stretch;overflow:hidden}.content>*{width:100%}
  .footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:${Math.round(S.gap * .65)}px;border-top:1px solid ${INK};font-size:${S.meta}px;color:${MUTED}}.footer strong{color:${INK};font-weight:700}
  .stat{display:flex;flex-direction:column;justify-content:flex-end;border-top:${Math.max(8, Math.round(S.meta * .7))}px solid ${accent};padding-top:${S.gap}px}.stat strong{display:block;font-size:${S.display}px;line-height:.8;letter-spacing:-.075em;font-weight:780}.stat p{margin:${S.gap}px 0 0;max-width:88%;font-size:${S.body * 1.1}px;line-height:1.15;font-weight:650}
  blockquote{position:relative;margin:0;padding:${S.gap * 1.15}px;padding-right:${Math.max(S.gap * 1.15, S.display * .72)}px;border-left:${Math.max(8, S.meta)}px solid ${accent};background:#FBF9F4;font-size:${S.body * 1.32}px;line-height:1.18;font-weight:680;letter-spacing:-.025em;display:flex;flex-direction:column;justify-content:center}blockquote>span{position:absolute;right:${S.gap}px;top:${Math.round(S.gap * .35)}px;color:${accent};font-size:${S.display}px;line-height:1}blockquote cite{display:block;margin-top:${S.gap}px;font-size:${S.meta}px;line-height:1.3;font-style:normal;font-weight:600;color:${MUTED}}
  .insight{display:flex;flex-direction:column;justify-content:center;border-top:2px solid ${accent};border-bottom:2px solid ${accent}}.insight p{margin:0;font-size:${S.body * 1.42}px;line-height:1.12;letter-spacing:-.035em;font-weight:720}.insight span{margin-top:${S.gap}px;font-size:${S.meta}px;color:${MUTED}}
  .finding-list{display:flex;flex-direction:column;justify-content:center}.finding{flex:1;display:grid;grid-template-columns:auto 1fr auto;gap:${S.gap}px;align-items:center;padding:${Math.round(S.gap * .62)}px 0;border-top:1px solid ${RULE}}.finding:last-child{border-bottom:1px solid ${RULE}}.finding-index{color:${accent};font-size:${S.meta}px;font-weight:750}.finding strong{display:block;font-size:${S.body}px;line-height:1.12}.finding p{margin:5px 0 0;font-size:${S.meta}px;line-height:1.3;color:${MUTED}}.finding b{font-size:${S.body * 1.12}px;color:${accent};letter-spacing:-.04em}
  .framework{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:${INK};border:1px solid ${INK}}.framework-step{min-height:0;background:${PAPER};padding:${Math.round(S.gap * .72)}px;display:grid;grid-template-columns:auto 1fr;gap:${Math.round(S.gap * .62)}px;align-content:start}.framework-step>span{display:grid;place-items:center;width:${S.body * 1.25}px;height:${S.body * 1.25}px;background:${accent};color:white;border-radius:50%;font-size:${S.meta}px;font-weight:750}.framework-step strong{font-size:${S.body * .9}px;line-height:1.12}.framework-step p{margin:6px 0 0;font-size:${S.meta}px;line-height:1.3;color:${MUTED}}
  .definition{display:flex;flex-direction:column;justify-content:center}.definition>strong{color:${accent};font-size:${S.display * .62}px;line-height:.9;letter-spacing:-.055em}.definition>p{margin:${S.gap}px 0;font-size:${S.body * 1.05}px;line-height:1.28}.definition aside{border-top:1px solid ${INK};padding-top:${Math.round(S.gap * .6)}px;font-size:${S.meta}px;line-height:1.35;color:${MUTED}}
  .split{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;border-top:1px solid ${INK};border-bottom:1px solid ${INK}}.split article{padding:${S.gap}px;display:flex;flex-direction:column;justify-content:center}.split article.after{background:${accent};color:white}.split>b{align-self:center;padding:0 ${Math.round(S.gap * .4)}px;color:${accent};font-size:${S.body}px}.split span{font-size:${S.meta}px;text-transform:uppercase;letter-spacing:.12em;opacity:.7}.split strong{margin-top:${Math.round(S.gap * .5)}px;font-size:${S.body * 1.12}px;line-height:1.08}.split p{margin:8px 0 0;font-size:${S.meta}px;line-height:1.35}
  .comparison{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid ${INK}}.comparison article{padding:${S.gap}px;border-right:1px solid ${INK}}.comparison article:last-child{border:0}.comparison article>strong{display:block;padding-bottom:${Math.round(S.gap * .6)}px;color:${accent};font-size:${S.body}px}.comparison p{margin:0;padding:${Math.round(S.gap * .5)}px 0;border-top:1px solid ${RULE};font-size:${S.meta}px}.comparison p span{display:block;margin-bottom:4px;color:${MUTED}}
  .bars{display:flex;flex-direction:column;justify-content:center;gap:${Math.round(S.gap * .65)}px}.bar-row{display:grid;grid-template-columns:minmax(70px,.65fr) 1.6fr auto;gap:${Math.round(S.gap * .55)}px;align-items:center;font-size:${S.meta}px}.bar-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-row i{display:block;height:${Math.max(12, S.meta)}px;background:${RULE}}.bar-row em{display:block;height:100%;background:${accent}}.bar-row strong{min-width:3em;text-align:right;font-size:${S.body}px}
  .timeline{display:flex;flex-direction:column;justify-content:center}.timeline article{display:grid;grid-template-columns:.5fr 1.5fr;gap:${S.gap}px;padding:${Math.round(S.gap * .62)}px 0;border-top:1px solid ${RULE}}.timeline article:last-child{border-bottom:1px solid ${RULE}}.timeline span{color:${accent};font-size:${S.meta}px;font-weight:700}.timeline strong{font-size:${S.body * .82}px;line-height:1.2}
  .visual-wrap{display:grid;place-items:center;overflow:hidden;background:#FBF9F4;border:1px solid ${RULE};padding:${Math.round(S.gap * .6)}px}.visual-wrap svg{width:100%;height:auto;max-height:100%}.html-visual{width:100%;font-size:${S.meta}px}.body-copy{align-self:center;margin:0;padding-left:${S.gap}px;border-left:${Math.max(6, Math.round(S.meta * .55))}px solid ${accent};font-size:${S.body * 1.1}px;line-height:1.3;font-weight:620}
  ${landscape ? "" : `.main{grid-template-rows:auto minmax(0,1fr)}.story{justify-content:flex-start}.caption{max-width:82%}`}`;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const accent = accentFor(input);
  const heading = panel.heading?.trim() || explainer.title;
  const content = contentFor(panel);
  const kicker = panel.plan?.keyFindings?.label ?? panel.plan?.framework?.label ?? panel.plan?.insight?.kicker ?? (panelIndex === 1 ? "The idea" : "The story");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><style>${baseCss(dims.w, dims.h, S, accent, headlineScale(heading.length), format === "landscape")}</style></head><body><main class="page ${content.mode}"><header class="top"><span class="source">${escapeHtml(sourceLabel(explainer.url))}</span><span class="index">${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</span></header><section class="main"><div class="story"><div><p class="kicker">${escapeHtml(kicker)}</p><h1>${escapeHtml(heading)}</h1></div>${panel.caption ? `<p class="caption">${escapeHtml(panel.caption)}</p>` : ""}</div><div class="content">${content.html}</div></section><footer class="footer"><span>From the original source</span><strong>readopp</strong></footer></main></body></html>`;
}

async function renderAttribution(input: AttributionRenderInput): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const accent = accentFor(input);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><style>${baseCss(dims.w, dims.h, S, accent, .9, format === "landscape")}.source-card{display:flex;flex-direction:column;justify-content:center;border-top:${Math.max(8, S.meta)}px solid ${accent}}.source-card span{font-size:${S.meta}px;color:${MUTED};text-transform:uppercase;letter-spacing:.12em}.source-card strong{margin-top:${S.gap}px;font-size:${S.body * 1.3}px;line-height:1.15;word-break:break-word}.source-card a{margin-top:${S.gap}px;color:${accent};font-size:${S.meta}px;line-height:1.35;font-weight:700;word-break:break-all;text-decoration:none}</style></head><body><main class="page"><header class="top"><span>Source note</span><span class="index">END</span></header><section class="main"><div class="story"><div><p class="kicker">Continue reading</p><h1>The post is the doorway, not the destination.</h1></div></div><div class="content"><section class="source-card"><span>Original work</span><strong>${escapeHtml(explainer.title)}</strong><a>${escapeHtml(explainer.url)}</a></section></div></section><footer class="footer"><span>${escapeHtml(sourceLabel(explainer.url))}</span><strong>readopp</strong></footer></main></body></html>`;
}

export const swissPosterTemplate: TemplateDef = {
  id: "swiss-poster",
  name: "Swiss Social",
  category: "Modern",
  tagline: "A mobile-first publishing system for evidence, ideas, and stories.",
  audience: "Writers and teams publishing useful work on LinkedIn and X.",
  preview: { background: PAPER, foreground: INK, accent: DEFAULT_ACCENT, sampleHeading: "One idea. Clearly made.", fontFamily: FONT },
  renderPanel,
  renderAttribution,
};
