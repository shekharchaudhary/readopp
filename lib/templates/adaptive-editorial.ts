import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type { RenderedPanel } from "../shared/schemas";
import type { AttributionRenderInput, PanelRenderInput, TemplateDef } from "./types";
import { chooseCarouselPanelLayout, type PanelLayoutId } from "./panelLayouts";
import { panelItems, panelKicker, panelPrimary } from "./panelCopy";

const PAPER = "#F5F2EA";
const INK = "#101010";
const MUTED = "#716E67";
const DEFAULT_ACCENT = "#E8422F";
const SANS = "'Helvetica Neue', Inter, Arial, sans-serif";
const SERIF = "Iowan Old Style, Baskerville, Georgia, serif";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function numericCopyValue(value: string | undefined, fallback: number): number {
  const match = value?.match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function accentFor(input: PanelRenderInput | AttributionRenderInput): string {
  return ("panel" in input ? input.panel.themeColor : undefined) ?? input.brand?.color ?? DEFAULT_ACCENT;
}

function itemsFor(panel: RenderedPanel): Array<{ title: string; detail: string }> {
  const items = panelItems(panel);
  return items.length ? items : [{ title: panel.heading, detail: panel.caption }];
}

function contentDensity(panel: RenderedPanel): "sparse" | "balanced" | "dense" {
  const items = panelItems(panel);
  const copyWeight =
    panel.heading.length +
    panelPrimary(panel).length +
    items.reduce((total, item) => total + item.title.length + item.detail.length, 0);
  if (panel.heading.length > 72 || items.length > 5 || copyWeight > 720) {
    return "dense";
  }
  if (panel.heading.length < 34 && items.length <= 1 && copyWeight < 150) {
    return "sparse";
  }
  return "balanced";
}

function renderCover(panel: RenderedPanel): string {
  return `<section class="cover"><p class="eyebrow">${esc(panelKicker(panel, panel.plan?.insight?.kicker ?? "THE READ"))}</p><h1>${esc(panel.heading)}</h1><div class="cover-bottom"><p>${esc(panelPrimary(panel))}</p><div class="image-field"><span></span><span></span><span></span></div></div></section>`;
}

function renderPriorities(panel: RenderedPanel): string {
  return `<section class="priorities"><header><p class="eyebrow">${esc(panelKicker(panel, "THE KEY POINTS"))}</p><h1>${esc(panel.heading)}</h1></header><div>${itemsFor(panel).slice(0, 5).map((item, index) => `<article><b>${index + 1}</b><section><h2>${esc(item.title)}</h2>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</section></article>`).join("")}</div></section>`;
}

function renderHierarchy(panel: RenderedPanel): string {
  const items = itemsFor(panel).slice(0, 4);
  return `<section class="hierarchy"><header><p class="eyebrow">${esc(panelKicker(panel, "A STRUCTURED VIEW"))}</p><h1>${esc(panel.heading)}</h1></header><div class="pyramid">${items.map((item, index) => `<article style="--level:${index + 1};--count:${items.length}"><b>${esc(item.title)}</b></article>`).join("")}</div><div class="hierarchy-notes">${items.map((item, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><p><strong>${esc(item.title)}</strong>${item.detail ? `<span>${esc(item.detail)}</span>` : ""}</p></article>`).join("")}</div></section>`;
}

function renderRadial(panel: RenderedPanel): string {
  const nodes = itemsFor(panel).slice(0, 6);
  return `<section class="radial"><header><p class="eyebrow">${esc(panelKicker(panel, "THE SYSTEM"))}</p><h1>${esc(panel.heading)}</h1></header><div class="orbit"><div class="hub">${esc(panel.plan?.stat?.value ?? "CORE")}</div>${nodes.map((node, index) => `<article class="node n${index}"><i></i><strong>${esc(node.title)}</strong>${node.detail ? `<span>${esc(node.detail)}</span>` : ""}</article>`).join("")}</div></section>`;
}

function renderArchitecture(panel: RenderedPanel): string {
  const copyItems = panelItems(panel);
  const generatedNodes = panel.plan?.nodes ?? copyItems.map((item, index) => ({ id: String(index), label: item.title, subtitle: item.detail, group: "Flow", role: null }));
  const nodes = generatedNodes.slice(0, 9).map((node, index) => ({ ...node, label: copyItems[index]?.title ?? node.label, subtitle: copyItems[index]?.detail ?? node.subtitle }));
  const groups = [...new Set(nodes.map((node) => node.group ?? "Flow"))];
  return `<section class="architecture"><header><p class="eyebrow">${esc(panelKicker(panel, "SYSTEM MAP"))}</p><h1>${esc(panel.heading)}</h1></header><div class="lanes">${groups.map((group) => `<section><b>${esc(group)}</b><div>${nodes.filter((node) => (node.group ?? "Flow") === group).map((node) => `<article class="${node.role === "highlight" ? "hot" : ""}"><strong>${esc(node.label)}</strong>${node.subtitle ? `<span>${esc(node.subtitle)}</span>` : ""}</article>`).join("")}</div></section>`).join("")}</div><p class="architecture-note">${esc(panel.caption)}</p></section>`;
}

function renderDiverging(panel: RenderedPanel): string {
  const chart = panel.plan?.chart;
  const points = chart?.series.flatMap((series) => series.points).slice(0, 10) ?? [];
  const copyItems = panel.copyOverrides?.items;
  const values = points.map((point, index) =>
    numericCopyValue(copyItems?.[index]?.detail, point.value)
  );
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  return `<section class="diverging"><header><p class="eyebrow">${esc(panelKicker(panel, chart?.title ?? "THE DATA"))}</p><h1>${esc(panel.heading)}</h1></header><div class="axis">${points.map((point, index) => { const value = values[index]; const width = Math.max(4, Math.round(Math.abs(value) / max * 48)); const itemDetail = copyItems?.[index]?.detail; const displayValue = itemDetail && /-?\d/.test(itemDetail) ? itemDetail : `${value > 0 ? "+" : ""}${value}${chart?.unit ?? ""}`; return `<article><span>${esc(copyItems?.[index]?.title ?? point.label)}</span><i class="${value < 0 ? "negative" : "positive"}" style="--bar:${width}%"></i><b>${esc(displayValue)}</b></article>`; }).join("")}</div></section>`;
}

function renderChart(panel: RenderedPanel): string {
  const chart = panel.plan?.chart;
  const points = chart?.series.flatMap((series) => series.points).slice(0, 8) ?? [];
  const copyItems = panel.copyOverrides?.items;
  const values = points.map((point, index) =>
    numericCopyValue(copyItems?.[index]?.detail, point.value)
  );
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  return `<section class="chart"><header><p class="eyebrow">${esc(panelKicker(panel, chart?.title ?? "THE DATA"))}</p><h1>${esc(panel.heading)}</h1></header><div class="bars">${points.map((point, index) => { const itemDetail = copyItems?.[index]?.detail; const displayValue = itemDetail && /-?\d/.test(itemDetail) ? itemDetail : `${values[index]}${chart?.unit ?? ""}`; return `<article><span>${esc(copyItems?.[index]?.title ?? point.label)}</span><i><em style="--bar:${Math.max(4, Math.round(Math.abs(values[index]) / max * 100))}%;--tone:${index}"></em></i><b>${esc(displayValue)}</b></article>`; }).join("")}</div></section>`;
}

function renderReport(panel: RenderedPanel): string {
  const body = panelPrimary(panel);
  const items = itemsFor(panel).slice(0, 4);
  return `<section class="report"><header><p>${esc(panelKicker(panel, "THE FIELD NOTE"))}</p><h1>${esc(panel.heading)}</h1><span>${esc(panel.plan?.definitionCard?.kicker ?? "A sourced visual brief")}</span></header><div class="diagram"><div class="center">${esc(panel.plan?.definitionCard?.term ?? "IDEA")}</div>${items.map((item) => `<article><b>${esc(item.title)}</b></article>`).join("")}</div><div class="columns"><p>${esc(body)}</p><p>${esc(items.map((item) => `${item.title}: ${item.detail}`).join(" "))}</p></div></section>`;
}

function renderContents(panel: RenderedPanel): string {
  const items = itemsFor(panel).slice(0, 7);
  return `<section class="contents"><header><p class="eyebrow">${esc(panelKicker(panel, "FIELD GUIDE"))}</p><h1>${esc(panel.heading)}</h1></header><div class="contents-grid"><section><h2>Contents</h2><ol>${items.map((item, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${esc(item.title)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ""}</span></li>`).join("")}</ol></section><div class="contents-art"><i></i><i></i><i></i><span>${esc(panel.plan?.definitionCard?.term ?? panel.plan?.stat?.value ?? "READ")}</span></div></div><p class="contents-note">${esc(panel.caption)}</p></section>`;
}

function renderEssay(panel: RenderedPanel): string {
  const primary = panelPrimary(panel);
  const supporting = itemsFor(panel).slice(0, 3);
  return `<section class="essay"><header><p class="eyebrow">${esc(panelKicker(panel, "THE ARGUMENT"))}</p><h1>${esc(panel.heading)}</h1></header><div class="essay-body"><p class="lead">${esc(primary)}</p><div class="essay-points">${supporting.map((item) => `<article><h2>${esc(item.title)}</h2>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</article>`).join("")}</div></div><blockquote>${esc(panel.caption)}</blockquote></section>`;
}

function css(
  w: number,
  h: number,
  accent: string,
  vertical: boolean,
  tall: boolean
): string {
  const pad = vertical ? 76 : 54;
  return `
  *,*::before,*::after{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}body{font-family:${SANS};color:${INK};background:${PAPER}}.page{position:relative;width:100%;height:100%;padding:${pad}px;background:${PAPER};overflow:hidden}.page::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(16,16,16,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(16,16,16,.045) 1px,transparent 1px);background-size:96px 96px;opacity:.7;pointer-events:none}.layout{position:relative;height:calc(100% - 45px)}.eyebrow{margin:0 0 20px;color:${accent};font-size:${vertical ? 24 : 17}px;font-weight:800;letter-spacing:.14em}h1{margin:0;font-size:${vertical ? 91 : 63}px;line-height:.94;letter-spacing:-.055em;text-wrap:balance}.meta{position:relative;height:45px;display:flex;align-items:flex-end;justify-content:space-between;border-top:2px solid ${INK};font-size:${vertical ? 19 : 14}px}.meta b{color:${accent}}
  .cover{height:100%;display:flex;flex-direction:column}.cover h1{max-width:92%;font-size:${vertical ? 126 : 83}px}.cover-bottom{margin-top:auto;display:grid;grid-template-columns:1fr .78fr;gap:42px;align-items:end}.cover-bottom>p{margin:0;padding-top:24px;border-top:2px solid ${INK};font-size:${vertical ? 31 : 22}px;line-height:1.25}.image-field{position:relative;height:${vertical ? 520 : 280}px;background:${accent};overflow:hidden}.image-field::before{content:"";position:absolute;width:75%;height:150%;left:18%;top:-25%;border:4px solid ${INK};border-radius:50%;mix-blend-mode:multiply}.image-field span{position:absolute;background:${INK}}.image-field span:nth-child(1){width:55%;height:12px;left:0;top:24%}.image-field span:nth-child(2){width:72%;height:12px;right:0;top:54%}.image-field span:nth-child(3){width:36%;height:12px;left:0;top:79%}
  .priorities,.hierarchy,.radial,.architecture,.chart,.diverging{height:100%;display:grid;grid-template-rows:auto 1fr;gap:${vertical ? 52 : 30}px}.priorities>div{display:flex;min-height:0;flex-direction:column;justify-content:center}.priorities article{display:grid;grid-template-columns:${vertical ? 92 : 62}px minmax(0,1fr);gap:24px;padding:${vertical ? 29 : 18}px 0;border-top:1px solid ${INK}}.priorities article:last-child{border-bottom:1px solid ${INK}}.priorities article>b{display:grid;place-items:center;width:${vertical ? 68 : 46}px;height:${vertical ? 68 : 46}px;border:2px solid ${INK};border-radius:50%;font-size:${vertical ? 30 : 20}px}.priorities h2{margin:0;font-size:${vertical ? 38 : 27}px;line-height:1.12}.priorities article p{margin:10px 0 0;color:${MUTED};font-size:${vertical ? 22 : 16}px;line-height:1.42}
  .hierarchy{grid-template-columns:.72fr 1.28fr;grid-template-rows:1fr}.hierarchy header{align-self:start}.pyramid{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:9px}.pyramid article{width:calc(38% + var(--level) * 13%);min-height:${vertical ? 105 : 70}px;display:grid;place-items:center;padding:12px;background:${accent};clip-path:polygon(13% 0,87% 0,100% 100%,0 100%);color:white;text-align:center;font-size:${vertical ? 26 : 18}px}.hierarchy-notes{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,1fr);gap:0 30px}.hierarchy-notes article{display:grid;grid-template-columns:40px 1fr;gap:16px;border-top:1px solid ${INK};padding:16px 0}.hierarchy-notes article>b{color:${accent}}.hierarchy-notes strong,.hierarchy-notes span{display:block}.hierarchy-notes span{margin-top:5px;color:${MUTED}}
  .radial{position:relative;display:block}.radial header{position:absolute;left:0;top:0;width:35%;z-index:2}.radial h1{font-size:${tall ? 72 : vertical ? 56 : 42}px;line-height:.96}.orbit{position:absolute;width:${tall ? 650 : vertical ? 430 : 350}px;height:${tall ? 650 : vertical ? 430 : 350}px;right:${tall ? 80 : vertical ? 60 : 50}px;top:50%;transform:translateY(-46%);border:2px dashed ${MUTED};border-radius:50%}.hub{position:absolute;inset:34%;display:grid;place-items:center;border-radius:50%;background:${accent};color:white;font-size:${tall ? 30 : vertical ? 25 : 20}px;font-weight:800}.node{position:absolute;width:${tall ? 205 : vertical ? 170 : 135}px;text-align:center;transform:translate(-50%,-50%)}.node i{display:block;width:20px;height:20px;margin:0 auto 7px;border:5px solid ${PAPER};border-radius:50%;background:${INK};box-shadow:0 0 0 2px ${INK}}.node strong,.node span{display:block}.node strong{font-size:${tall ? 25 : vertical ? 19 : 14}px;line-height:1.05}.node span{margin-top:4px;color:${MUTED};font-size:${tall ? 17 : vertical ? 13 : 10}px;line-height:1.15}.n0{left:50%;top:5%}.n1{left:94%;top:27%}.n2{left:88%;top:78%}.n3{left:12%;top:78%}.n4{left:6%;top:27%}.n5{left:50%;top:95%}
  .architecture .lanes{display:flex;flex-direction:column;justify-content:center;gap:18px}.lanes>section{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center}.lanes>section>b{color:${accent};text-transform:uppercase;font-size:${vertical ? 18 : 13}px}.lanes>section>div{position:relative;display:flex;gap:14px}.lanes>section>div::after{content:"↓";position:absolute;left:50%;bottom:-24px;color:${MUTED}}.lanes article{flex:1;min-height:${vertical ? 96 : 65}px;padding:16px;border:2px solid ${INK};border-radius:999px;display:flex;flex-direction:column;justify-content:center;text-align:center}.lanes article.hot{background:${accent};color:white;border-color:${accent}}.lanes article span{font-size:.8em;opacity:.7}.architecture-note{margin:0;padding-top:18px;border-top:1px solid ${INK};color:${MUTED}}
  .axis{align-self:center}.axis article{display:grid;grid-template-columns:${vertical ? 260 : 180}px 1fr 90px;align-items:center;min-height:${vertical ? 60 : 40}px;font-size:${vertical ? 21 : 15}px}.axis i{position:relative;height:${vertical ? 32 : 22}px;background:linear-gradient(90deg,transparent 49.8%,${INK} 50%,transparent 50.2%)}.axis i::before{content:"";position:absolute;top:0;height:100%;width:var(--bar)}.axis i.positive::before{left:50%;background:#258A55}.axis i.negative::before{right:50%;background:${accent}}.axis b{padding-left:15px}.diverging header{max-width:90%}
  .bars{align-self:center;display:flex;flex-direction:column;gap:${vertical ? 22 : 14}px}.bars article{display:grid;grid-template-columns:${vertical ? 260 : 180}px 1fr 100px;gap:18px;align-items:center;font-size:${vertical ? 21 : 15}px}.bars i{height:${vertical ? 40 : 28}px;background:rgba(16,16,16,.09)}.bars em{display:block;width:var(--bar);height:100%;background:${accent};opacity:calc(1 - var(--tone) * .07)}.bars b{font-size:${vertical ? 25 : 18}px}.chart header{max-width:92%}
  .report{height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:28px;font-family:${SERIF}}.report header{text-align:center}.report header p,.report header span{font-style:italic}.report h1{font-family:${SERIF};font-size:${vertical ? 69 : 48}px;letter-spacing:-.03em}.diagram{align-self:center;justify-self:center;position:relative;width:78%;height:${vertical ? 410 : 250}px;display:grid;grid-template-columns:repeat(2,1fr);gap:18px;align-content:center}.diagram::before{content:"";position:absolute;inset:14%;border:2px solid ${INK};transform:rotate(45deg)}.diagram .center{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 34px;border:2px solid ${INK};background:${PAPER};font-weight:700}.diagram article{position:relative;z-index:1;padding:16px;border:2px solid ${INK};background:${PAPER};text-align:center}.columns{display:grid;grid-template-columns:1fr 1fr;gap:28px;border-top:2px solid ${INK};padding-top:20px}.columns p{margin:0;font-size:${vertical ? 17 : 12}px;line-height:1.3;text-align:justify}
  .contents{height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:${vertical ? 42 : 26}px}.contents header{max-width:84%}.contents h1{font-size:${vertical ? 78 : 52}px}.contents-grid{display:grid;grid-template-columns:1.18fr .82fr;gap:${vertical ? 48 : 30}px;min-height:0}.contents-grid>section{align-self:center}.contents h2{margin:0 0 22px;font-size:${vertical ? 40 : 27}px}.contents ol{list-style:none;margin:0;padding:0;border-top:2px solid ${INK}}.contents li{display:grid;grid-template-columns:${vertical ? 58 : 40}px 1fr;gap:12px;padding:${vertical ? 15 : 9}px 0;border-bottom:1px solid ${MUTED}}.contents li>b{color:${accent}}.contents li strong,.contents li small{display:block}.contents li strong{font-size:${vertical ? 22 : 15}px}.contents li small{margin-top:4px;color:${MUTED};font-size:${vertical ? 14 : 10}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contents-art{position:relative;align-self:stretch;overflow:hidden;border-radius:999px 0 0 999px;background:linear-gradient(145deg,${INK},${MUTED})}.contents-art::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 0 42%,${accent} 42% 47%,transparent 47% 100%),repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 2px,transparent 2px 42px)}.contents-art i{position:absolute;border:2px solid rgba(255,255,255,.55);border-radius:50%}.contents-art i:nth-child(1){width:72%;aspect-ratio:1;right:-18%;top:5%}.contents-art i:nth-child(2){width:48%;aspect-ratio:1;left:8%;bottom:-8%}.contents-art i:nth-child(3){width:30%;aspect-ratio:1;right:18%;bottom:12%;background:${accent};border:0}.contents-art span{position:absolute;left:13%;bottom:11%;color:white;font-size:${vertical ? 28 : 18}px;font-weight:800;letter-spacing:.08em}.contents-note{margin:0;max-width:72%;padding-top:16px;border-top:2px solid ${INK};color:${MUTED};font-size:${vertical ? 18 : 13}px}
  .essay{height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:${vertical ? 46 : 28}px}.essay header{padding-bottom:${vertical ? 36 : 22}px;border-bottom:1px solid ${MUTED}}.essay h1{max-width:94%;font-size:${vertical ? 91 : 62}px}.essay-body{display:grid;grid-template-columns:.34fr .66fr;gap:${vertical ? 58 : 38}px;align-items:start}.essay .lead{margin:0;padding-top:8px;font-size:${vertical ? 25 : 17}px;line-height:1.35}.essay-points{display:flex;flex-direction:column}.essay-points article{padding:${vertical ? 22 : 14}px 0;border-top:1px solid ${INK}}.essay-points article:last-child{border-bottom:1px solid ${INK}}.essay-points h2{margin:0;font-size:${vertical ? 32 : 22}px;line-height:1.05}.essay-points p{margin:8px 0 0;color:${MUTED};font-size:${vertical ? 19 : 13}px;line-height:1.35}.essay blockquote{margin:0;padding:${vertical ? 25 : 16}px 0 0;border-top:${vertical ? 8 : 5}px dotted ${INK};font-size:${vertical ? 36 : 24}px;line-height:1.15;font-weight:650}
  ${vertical && !tall ? `
  .cover h1{font-size:100px}.cover .image-field{height:360px}
  .orbit{width:410px;height:410px}
  ` : ""}
  ${tall ? `
  .priorities article{grid-template-columns:108px minmax(0,1fr);padding:38px 0}.priorities article>b{width:78px;height:78px;font-size:34px}.priorities h2{font-size:44px}.priorities article p{font-size:26px}
  .pyramid article{min-height:138px;font-size:32px}.hierarchy-notes article{grid-template-columns:52px 1fr;padding:25px 0}.hierarchy-notes article>b{font-size:24px}.hierarchy-notes strong{font-size:27px}.hierarchy-notes span{font-size:22px}
  .orbit{width:650px;height:650px}.node strong{font-size:25px}.node span{font-size:17px}
  .lanes>section{grid-template-columns:190px 1fr;gap:24px}.lanes>section>b{font-size:23px}.lanes article{min-height:132px;font-size:27px}.lanes article span{font-size:21px}.architecture-note{font-size:24px}
  .bars{gap:34px}.bars article{grid-template-columns:280px 1fr 130px;gap:24px;font-size:29px}.bars i{height:54px}.bars b{font-size:32px}
  .axis article{grid-template-columns:280px 1fr 130px;min-height:84px;font-size:28px}.axis i{height:44px}.axis b{font-size:29px}
  .report h1{font-size:78px}.diagram{height:650px}.diagram article{padding:24px;font-size:25px}.diagram .center{padding:28px 40px;font-size:27px}.columns{gap:40px;padding-top:28px}.columns p{font-size:24px;line-height:1.42}
  .contents h1{font-size:92px}.contents h2{font-size:48px}.contents li{grid-template-columns:70px 1fr;padding:24px 0}.contents li>b{font-size:24px}.contents li strong{font-size:29px}.contents li small{font-size:21px}.contents-note{font-size:24px}
  .essay .lead{font-size:31px}.essay-points article{padding:34px 0}.essay-points h2{font-size:42px}.essay-points p{font-size:27px}.essay blockquote{font-size:46px}
  ` : ""}
  ${!vertical ? `
  .cover .image-field{height:180px}
  .priorities{gap:12px}.priorities h1{font-size:48px}.priorities article{grid-template-columns:48px 1fr;gap:14px;padding:7px 0}.priorities article>b{width:34px;height:34px;font-size:16px}.priorities h2{font-size:20px}.priorities article p{margin-top:3px;font-size:11px}
  .hierarchy{grid-template-columns:.55fr 1fr;grid-template-rows:1fr}.hierarchy h1{font-size:50px}.hierarchy-notes{display:none}.pyramid article{min-height:58px;font-size:15px}
  .orbit{width:330px;height:330px}.node{width:125px}.node strong{font-size:13px}.node span{font-size:9px}
  .architecture{gap:12px}.architecture h1{font-size:48px}.architecture .lanes{gap:8px}.lanes>section{grid-template-columns:120px 1fr;gap:10px}.lanes article{min-height:44px;padding:8px}.architecture-note{padding-top:8px;font-size:10px}
  .report{gap:10px}.report h1{font-size:37px}.diagram{height:165px}.diagram .center{padding:12px 18px}.diagram article{padding:8px;font-size:11px}.columns{gap:16px;padding-top:9px}.columns p{font-size:9px;line-height:1.25}
  .contents{gap:12px}.contents h1{font-size:43px}.contents h2{margin-bottom:9px;font-size:22px}.contents li{padding:5px 0}.contents li strong{font-size:12px}.contents li small{font-size:8px}.contents-note{padding-top:7px;font-size:9px}
  ` : ""}
  .page[data-content-density="dense"] h1{font-size:${vertical ? 56 : 38}px!important;line-height:.98!important}
  .page[data-content-density="dense"] .cover h1{font-size:${vertical ? 68 : 44}px!important;max-width:100%}
  .page[data-content-density="dense"] .cover-bottom{gap:${vertical ? 28 : 18}px}
  .page[data-content-density="dense"] .cover-bottom>p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:${vertical ? 6 : 4};font-size:${vertical ? 23 : 15}px;line-height:1.22}
  .page[data-content-density="dense"] .cover .image-field{height:${vertical ? 330 : 150}px!important}
  .page[data-content-density="dense"] .priorities{gap:${vertical ? 20 : 8}px}
  .page[data-content-density="dense"] .priorities article{grid-template-columns:${vertical ? 64 : 42}px minmax(0,1fr);gap:${vertical ? 16 : 10}px;padding:${vertical ? 10 : 5}px 0}
  .page[data-content-density="dense"] .priorities article>b{width:${vertical ? 48 : 30}px;height:${vertical ? 48 : 30}px;font-size:${vertical ? 21 : 13}px}
  .page[data-content-density="dense"] .priorities h2{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:${vertical ? 25 : 17}px;line-height:1.05}
  .page[data-content-density="dense"] .priorities article p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;margin-top:5px;font-size:${vertical ? 15 : 10}px;line-height:1.2}
  .page[data-content-density="dense"] .hierarchy{grid-template-columns:1fr;grid-template-rows:auto auto 1fr;gap:${vertical ? 16 : 8}px}
  .page[data-content-density="dense"] .hierarchy header{max-width:100%}
  .page[data-content-density="dense"] .pyramid{gap:5px}
  .page[data-content-density="dense"] .pyramid article{min-height:${vertical ? 54 : 36}px;padding:7px;font-size:${vertical ? 17 : 11}px}
  .page[data-content-density="dense"] .hierarchy-notes{grid-column:auto;gap:0 20px}
  .page[data-content-density="dense"] .hierarchy-notes article{padding:${vertical ? 8 : 4}px 0}
  .page[data-content-density="dense"] .hierarchy-notes strong{font-size:${vertical ? 17 : 11}px}
  .page[data-content-density="dense"] .hierarchy-notes span{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:${vertical ? 13 : 9}px;line-height:1.15}
  .page[data-content-density="dense"] .architecture{gap:${vertical ? 14 : 6}px}
  .page[data-content-density="dense"] .architecture .lanes{gap:${vertical ? 7 : 4}px}
  .page[data-content-density="dense"] .lanes>section{grid-template-columns:${vertical ? 116 : 86}px 1fr;gap:${vertical ? 10 : 6}px}
  .page[data-content-density="dense"] .lanes>section>b{font-size:${vertical ? 13 : 9}px}
  .page[data-content-density="dense"] .lanes article{min-height:${vertical ? 62 : 35}px;padding:${vertical ? 8 : 5}px;font-size:${vertical ? 15 : 10}px}
  .page[data-content-density="dense"] .lanes article span{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:${vertical ? 11 : 8}px;line-height:1.1}
  .page[data-content-density="dense"] .architecture-note{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;padding-top:8px;font-size:${vertical ? 14 : 9}px}
  .page[data-content-density="dense"] .chart,.page[data-content-density="dense"] .diverging{grid-template-rows:auto minmax(0,1fr);gap:${vertical ? 18 : 8}px}
  .page[data-content-density="dense"] .bars,.page[data-content-density="dense"] .axis{min-height:0;align-self:stretch;justify-content:center;overflow:hidden}
  .page[data-content-density="dense"] .bars{gap:${vertical ? 5 : 3}px}
  .page[data-content-density="dense"] .bars article,.page[data-content-density="dense"] .axis article{grid-template-columns:${vertical ? 210 : 145}px minmax(0,1fr) ${vertical ? 84 : 60}px;min-height:0;height:${vertical ? 39 : 25}px;gap:${vertical ? 12 : 8}px;font-size:${vertical ? 13 : 9}px}
  .page[data-content-density="dense"] .bars article>span,.page[data-content-density="dense"] .axis article>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .page[data-content-density="dense"] .bars i{height:${vertical ? 28 : 18}px}
  .page[data-content-density="dense"] .bars b,.page[data-content-density="dense"] .axis b{font-size:${vertical ? 16 : 11}px}
  .page[data-content-density="dense"] .axis i{height:${vertical ? 25 : 16}px}
  .page[data-content-density="dense"] .report{gap:${vertical ? 18 : 8}px}
  .page[data-content-density="dense"] .report h1{font-size:${vertical ? 50 : 34}px!important}
  .page[data-content-density="dense"] .diagram{height:${vertical ? 300 : 150}px!important}
  .page[data-content-density="dense"] .diagram article{overflow:hidden;padding:${vertical ? 12 : 7}px;font-size:${vertical ? 17 : 10}px}
  .page[data-content-density="dense"] .columns{gap:${vertical ? 24 : 14}px;padding-top:${vertical ? 13 : 7}px}
  .page[data-content-density="dense"] .columns p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:${vertical ? 8 : 5};font-size:${vertical ? 14 : 8}px;line-height:1.2}
  .page[data-content-density="dense"] .contents{gap:${vertical ? 22 : 10}px}
  .page[data-content-density="dense"] .contents h1{font-size:${vertical ? 54 : 36}px!important}
  .page[data-content-density="dense"] .contents-grid{gap:${vertical ? 28 : 16}px}
  .page[data-content-density="dense"] .contents h2{margin-bottom:${vertical ? 12 : 6}px;font-size:${vertical ? 30 : 19}px}
  .page[data-content-density="dense"] .contents li{grid-template-columns:${vertical ? 46 : 32}px 1fr;padding:${vertical ? 8 : 4}px 0}
  .page[data-content-density="dense"] .contents li strong{font-size:${vertical ? 16 : 10}px}
  .page[data-content-density="dense"] .contents li small{font-size:${vertical ? 11 : 7}px}
  .page[data-content-density="dense"] .contents-note{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}
  .page[data-content-density="dense"] .radial h1{font-size:${vertical ? 43 : 31}px!important;line-height:.94!important}
  .page[data-content-density="dense"] .radial .orbit{width:${vertical ? 420 : 300}px;height:${vertical ? 420 : 300}px}
  .page[data-content-density="dense"] .essay{gap:${vertical ? 22 : 10}px}
  .page[data-content-density="dense"] .essay h1{font-size:${vertical ? 54 : 36}px!important}
  .page[data-content-density="dense"] .essay-body{gap:${vertical ? 32 : 18}px}
  .page[data-content-density="dense"] .essay .lead{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:${vertical ? 10 : 6};font-size:${vertical ? 19 : 12}px;line-height:1.25}
  .page[data-content-density="dense"] .essay-points article{padding:${vertical ? 10 : 5}px 0}
  .page[data-content-density="dense"] .essay-points h2{font-size:${vertical ? 23 : 15}px}
  .page[data-content-density="dense"] .essay-points p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;margin-top:5px;font-size:${vertical ? 14 : 9}px;line-height:1.2}
  .page[data-content-density="dense"] .essay blockquote{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;padding-top:${vertical ? 14 : 8}px;font-size:${vertical ? 25 : 16}px}
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { panel, explainer, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const sequencePanels = explainer.panels.map((candidate, index) =>
    index === panelIndex - 1 ? panel : candidate
  );
  const layout: PanelLayoutId = chooseCarouselPanelLayout(sequencePanels, panelIndex);
  const content = layout === "cover" ? renderCover(panel) : layout === "hierarchy" ? renderHierarchy(panel) : layout === "radial" ? renderRadial(panel) : layout === "architecture" ? renderArchitecture(panel) : layout === "chart" ? renderChart(panel) : layout === "diverging" ? renderDiverging(panel) : layout === "priorities" ? renderPriorities(panel) : layout === "contents" ? renderContents(panel) : layout === "essay" ? renderEssay(panel) : renderReport(panel);
  // Square and vertical exports share the same 1080px reading width and are
  // commonly viewed on phones. Give both the larger social typography;
  // landscape alone uses the compact wide-format scale.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css(dims.w, dims.h, accentFor(input), format !== "landscape", format === "vertical")}</style></head><body><main class="page" data-adaptive-layout="${layout}" data-content-density="${contentDensity(panel)}"><div class="layout">${content}</div><footer class="meta"><span>${esc(sourceLabel(explainer.url))}</span><b>${String(panelIndex).padStart(2, "0")} / ${String(totalPanels).padStart(2, "0")}</b><strong>readopp</strong></footer></main></body></html>`;
}

async function renderAttribution(input: AttributionRenderInput): Promise<string> {
  const dims = EXPORT_DIMENSIONS[input.format];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css(dims.w, dims.h, accentFor(input), input.format !== "landscape", input.format === "vertical")}.end{height:100%;display:flex;flex-direction:column;justify-content:space-between}.end h1{max-width:88%}.end a{font-size:24px;color:${accentFor(input)};word-break:break-all}</style></head><body><main class="page"><section class="layout end"><p class="eyebrow">CONTINUE READING</p><h1>${esc(input.explainer.title)}</h1><a>${esc(input.explainer.url)}</a></section><footer class="meta"><span>Original source</span><b>END</b><strong>readopp</strong></footer></main></body></html>`;
}

export const adaptiveEditorialTemplate: TemplateDef = {
  id: "adaptive-editorial",
  name: "Adaptive Editorial",
  category: "Editorial",
  tagline: "One coherent carousel, with a composition chosen for every idea.",
  audience: "Professionals publishing research, frameworks, diagrams, and arguments on LinkedIn.",
  preview: { background: PAPER, foreground: INK, accent: DEFAULT_ACCENT, sampleHeading: "The layout follows the idea.", fontFamily: SANS },
  renderPanel,
  renderAttribution,
};
