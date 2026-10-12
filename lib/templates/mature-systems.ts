import type { TemplateDef } from "./types";
import { adaptiveEditorialTemplate } from "./adaptive-editorial";

interface SystemStyle {
  id: "editorial-report" | "modern-technical" | "data-story" | "bold-social";
  name: string;
  category: TemplateDef["category"];
  tagline: string;
  audience: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  font: string;
  sample: string;
}

const BASE = {
  paper: "#F5F2EA",
  ink: "#101010",
  muted: "#716E67",
  accent: "#E8422F",
  font: "'Helvetica Neue', Inter, Arial, sans-serif",
};

function replaceAll(value: string, from: string, to: string): string {
  return value.split(from).join(to);
}

function identityCss(style: SystemStyle): string {
  if (style.id === "editorial-report") {
    return `
      .page::before{opacity:.18;background-size:100% 100%}
      .layout h1{font-family:Iowan Old Style,Baskerville,Georgia,serif;font-weight:650;letter-spacing:-.035em}
      .eyebrow,.meta{font-family:Arial,'Helvetica Neue',sans-serif}
      .priorities article,.essay header,.contents ol{border-color:${style.accent}}
      .diagram article{box-shadow:5px 5px 0 rgba(39,76,119,.12)}
      .architecture{grid-template-rows:auto minmax(0,1fr) auto}
      .architecture .lanes,.chart .bars,.diverging .axis{position:relative;min-height:0;border:1px solid #D8D2C8;padding:54px 28px 28px}
      .architecture .lanes::before,.chart .bars::before,.diverging .axis::before{content:"FIGURE · EVIDENCE MODEL";position:absolute;left:28px;top:18px;color:${style.accent};font:700 13px/1 Arial,'Helvetica Neue',sans-serif;letter-spacing:.08em}
      .architecture .lanes{justify-content:center}
      .lanes>section>b{font-family:Iowan Old Style,Baskerville,Georgia,serif;text-transform:none;color:${style.ink}}
      .lanes article{border-radius:0;background:${style.paper};box-shadow:4px 4px 0 rgba(39,76,119,.10);font-family:Iowan Old Style,Baskerville,Georgia,serif}
      .lanes article.hot{background:${style.paper};color:${style.ink};border-color:${style.accent};box-shadow:4px 4px 0 rgba(39,76,119,.18)}
      .architecture-note{padding-top:12px;font-family:Iowan Old Style,Baskerville,Georgia,serif;font-style:italic;line-height:1.15}
      .axis article,.bars article{border-bottom:1px solid #E0DBD2}
      .axis article:last-child,.bars article:last-child{border-bottom:0}
      .axis span,.bars span{font-family:Iowan Old Style,Baskerville,Georgia,serif;font-weight:650}
      .page[data-content-density="dense"] .architecture .lanes,.page[data-content-density="dense"] .chart .bars,.page[data-content-density="dense"] .diverging .axis{padding:42px 20px 16px}
      .page[data-content-density="dense"] .architecture .lanes::before,.page[data-content-density="dense"] .chart .bars::before,.page[data-content-density="dense"] .diverging .axis::before{left:20px;top:14px;font-size:10px}
      @media (min-aspect-ratio:1.2){.architecture .lanes,.chart .bars,.diverging .axis{padding:34px 18px 14px}.architecture .lanes::before,.chart .bars::before,.diverging .axis::before{left:18px;top:11px;font-size:9px}}
    `;
  }
  if (style.id === "modern-technical") {
    return `
      .page{border:3px solid ${style.accent}}
      .page::before{background-size:48px 48px;opacity:.8}
      .eyebrow,.meta,.lanes>section>b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .lanes article,.priorities article>b,.diagram article{border-radius:4px}
      .lanes article,.diagram article{box-shadow:5px 5px 0 rgba(8,120,209,.14)}
      .image-field{clip-path:polygon(12% 0,100% 0,100% 88%,88% 100%,0 100%,0 12%)}
      .orbit{border-style:solid}
    `;
  }
  if (style.id === "data-story") {
    return `
      .page::before{background-image:linear-gradient(rgba(16,38,26,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(16,38,26,.035) 1px,transparent 1px);background-size:100% 72px,72px 100%;opacity:.8}
      .layout h1{letter-spacing:-.045em}
      .priorities>header,.hierarchy>header,.radial>header,.architecture>header,.chart>header,.diverging>header,.contents>header,.essay>header,.report>header{padding:24px 28px;border-left:10px solid ${style.accent};background:${style.ink};color:${style.paper}}
      .priorities>header h1,.hierarchy>header h1,.radial>header h1,.architecture>header h1,.chart>header h1,.diverging>header h1,.contents>header h1,.essay>header h1,.report>header h1{color:${style.paper}}
      .eyebrow{padding-left:0;border-left:0;color:#8DDAA8}
      .report>header p,.report>header span{color:#AFC1B5}
      .priorities article>b{border:0;background:${style.accent};color:white}
      .diagram article{border-top:7px solid ${style.accent};box-shadow:7px 7px 0 rgba(30,140,82,.13)}
      .diagram .center{border-color:${style.accent};background:${style.accent};color:white}
      .lanes article{border-left:9px solid ${style.accent}}
      .axis b,.bars b{color:${style.accent}}
      .image-field{background:linear-gradient(150deg,${style.accent},#13231A)}
      .meta b{padding:5px 10px;background:${style.accent};color:white}
      .meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      @media (min-aspect-ratio:1.2){.priorities>header,.hierarchy>header,.radial>header,.architecture>header,.chart>header,.diverging>header,.contents>header,.essay>header,.report>header{padding:14px 18px}}
    `;
  }
  return `
    .page{border:12px solid ${style.accent}}
    .page::before{opacity:.14;background-size:120px 120px}
    .eyebrow{display:inline-block;width:max-content;padding:8px 13px;background:${style.accent};color:#171717}
    .layout h1{text-transform:uppercase;letter-spacing:-.07em}
    .priorities article,.essay header,.contents ol{border-width:4px}
    .lanes article,.diagram article{border-width:4px;box-shadow:9px 9px 0 ${style.accent}}
    .pyramid article{color:#171717}
    .meta{border-top-width:5px;text-transform:uppercase}
    @media (min-aspect-ratio:.8) and (max-aspect-ratio:1.2){
      .cover h1{font-size:82px}
      .cover .image-field{height:340px}
      .cover-bottom>p{font-size:24px}
      .priorities h1{font-size:72px}
      .priorities article{padding:14px 0}
      .priorities h2{font-size:31px}
      .priorities article p{font-size:18px}
      .hierarchy{grid-template-rows:minmax(0,1fr) auto}
      .hierarchy h1{font-size:82px}
      .hierarchy-notes article{padding:12px 0}
      .radial .orbit{width:450px;height:450px}
      .architecture{gap:34px}
      .architecture h1{font-size:78px}
      .architecture .lanes{gap:13px}
      .architecture .lanes article{min-height:86px;padding:12px}
      .architecture-note{padding-top:10px;font-size:14px}
      .page[data-content-density="dense"] .cover h1{font-size:58px!important;line-height:.91!important}
      .page[data-content-density="dense"] .cover .image-field{height:250px!important}
      .page[data-content-density="dense"] .cover-bottom>p{font-size:17px;line-height:1.14;-webkit-line-clamp:5}
      .page[data-content-density="dense"] .hierarchy h1{font-size:48px!important}
      .page[data-content-density="dense"] .hierarchy-notes article{padding:6px 0}
      .page[data-content-density="dense"] .contents{gap:12px}
      .page[data-content-density="dense"] .contents h1{font-size:43px!important;line-height:.91!important}
      .page[data-content-density="dense"] .contents-grid{gap:18px}
      .page[data-content-density="dense"] .contents h2{margin-bottom:7px;font-size:24px}
      .page[data-content-density="dense"] .contents li{padding:3px 0}
      .page[data-content-density="dense"] .contents li strong{font-size:14px;line-height:1.05}
      .page[data-content-density="dense"] .contents li small{font-size:9px}
      .page[data-content-density="dense"] .contents-note{max-width:68%;padding-top:9px;font-size:11px;line-height:1.15}
    }
    @media (min-aspect-ratio:1.2){
      .page[data-content-density="dense"] .contents{gap:6px}
      .page[data-content-density="dense"] .contents h1{font-size:32px!important;line-height:.9!important}
      .page[data-content-density="dense"] .contents h2{margin-bottom:4px;font-size:18px}
      .page[data-content-density="dense"] .contents li{padding:2px 0}
      .page[data-content-density="dense"] .contents li strong{font-size:9px;line-height:1.05}
      .page[data-content-density="dense"] .contents li small{display:none}
      .page[data-content-density="dense"] .contents-note{display:none}
    }
  `;
}

function restyle(html: string, style: SystemStyle): string {
  const recolored = [
    [BASE.paper, style.paper],
    [BASE.ink, style.ink],
    [BASE.muted, style.muted],
    [BASE.accent, style.accent],
    [BASE.font, style.font],
  ].reduce((output, [from, to]) => replaceAll(output, from, to), html);
  return recolored.replace("</style>", `${identityCss(style)}</style>`);
}

function makeSystem(style: SystemStyle): TemplateDef {
  return {
    id: style.id,
    name: style.name,
    category: style.category,
    tagline: style.tagline,
    audience: style.audience,
    preview: {
      background: style.paper,
      foreground: style.ink,
      accent: style.accent,
      sampleHeading: style.sample,
      fontFamily: style.font,
    },
    async renderPanel(input) {
      return restyle(await adaptiveEditorialTemplate.renderPanel(input), style);
    },
    async renderAttribution(input) {
      return restyle(await adaptiveEditorialTemplate.renderAttribution(input), style);
    },
  };
}

export const editorialReportTemplate = makeSystem({
  id: "editorial-report",
  name: "Editorial Report",
  category: "Editorial",
  tagline: "Research-paper authority with disciplined typography and evidence-led pages.",
  audience: "Researchers, analysts, and writers sharing substantive source material.",
  paper: "#FBFAF6",
  ink: "#151515",
  muted: "#625E57",
  accent: "#274C77",
  font: "Arial, 'Helvetica Neue', sans-serif",
  sample: "Evidence, arranged with authority.",
});

export const modernTechnicalTemplate = makeSystem({
  id: "modern-technical",
  name: "Modern Technical",
  category: "Technical",
  tagline: "Clear architecture, system maps, and technical frameworks without diagram clutter.",
  audience: "Engineers, technical founders, and product teams.",
  paper: "#F2F6F8",
  ink: "#10202B",
  muted: "#5D6E78",
  accent: "#0878D1",
  font: "'IBM Plex Sans', Inter, Arial, sans-serif",
  sample: "Make the system understandable.",
});

export const dataStoryTemplate = makeSystem({
  id: "data-story",
  name: "Data Story",
  category: "Modern",
  tagline: "Charts, comparisons, and findings built for fast mobile comprehension.",
  audience: "Analysts and operators publishing evidence on LinkedIn.",
  paper: "#F2F6F2",
  ink: "#10261A",
  muted: "#5F7167",
  accent: "#1E8C52",
  font: "Inter, Arial, sans-serif",
  sample: "Let the evidence lead.",
});

export const boldSocialTemplate = makeSystem({
  id: "bold-social",
  name: "Bold Social",
  category: "Bold",
  tagline: "Large hooks and decisive contrast for arguments that need feed presence.",
  audience: "Founders and creators making a clear point of view.",
  paper: "#171717",
  ink: "#F7F1E7",
  muted: "#B8B0A5",
  accent: "#FF5C35",
  font: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
  sample: "A point worth stopping for.",
});
