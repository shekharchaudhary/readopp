/**
 * Single-page résumé *document* renderer — the download/print half of the
 * resume feature (Option B). Where `resumeDeck.ts` draws a square social
 * carousel, this builds a real A4/US-Letter résumé as semantic HTML so the
 * export route can print it to a selectable-text PDF (which also keeps it
 * ATS-parseable, unlike a flattened image).
 *
 * One structured `ResumeDoc` feeds three layouts:
 *   - classic  — traditional single column, centred header (ATS-safe)
 *   - modern   — coloured header band + two-column body (the "Canva" look)
 *   - minimal  — understated single column, lots of whitespace
 *
 * Pure string output, no DOM. Fonts are system stacks so Chromium can print
 * without a network round-trip to a font CDN.
 */

import type { ResumeDoc } from "../shared/schemas";
import { escapeXml as esc } from "./system/panelChrome";

export const RESUME_PAGE_TEMPLATES = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Traditional single column — the safest for applicant tracking systems.",
  },
  {
    id: "modern",
    label: "Modern",
    blurb: "Coloured header band over a two-column body.",
  },
  {
    id: "minimal",
    label: "Minimal",
    blurb: "Understated, lots of whitespace, sans-serif.",
  },
] as const;

export type ResumePageTemplateId = (typeof RESUME_PAGE_TEMPLATES)[number]["id"];

export function isResumePageTemplate(v: string): v is ResumePageTemplateId {
  return RESUME_PAGE_TEMPLATES.some((t) => t.id === v);
}

const COLOR = {
  ink: "#1F1B16",
  inkSoft: "#3C362E",
  muted: "#6F665A",
  faint: "#928879",
  line: "#E3DDD1",
  accent: "#B07A3C",
  accentDeep: "#8A5C28",
  band: "#221E18",
  bandText: "#F4EFE6",
  bandMuted: "#B7AD9C",
  sidebar: "#F6F2EA",
  paper: "#FFFFFF",
} as const;

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";

// --- small fragment helpers ------------------------------------------------

function contactItems(doc: ResumeDoc): string[] {
  const c = doc.contact;
  const items: string[] = [];
  if (c.email) items.push(esc(c.email));
  if (c.phone) items.push(esc(c.phone));
  if (c.location) items.push(esc(c.location));
  for (const l of c.links) {
    items.push(
      `<a href="${esc(l.url)}">${esc(l.label)}</a>`
    );
  }
  return items;
}

function sectionTitle(t: string): string {
  return `<h2 class="sec">${esc(t)}</h2>`;
}

function experienceHtml(doc: ResumeDoc): string {
  if (!doc.experience.length) return "";
  const items = doc.experience
    .map((r) => {
      const sub = [r.company, r.location].filter((x): x is string => Boolean(x)).map(esc).join(" · ");
      const bullets = r.bullets.length
        ? `<ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : "";
      return `
        <div class="entry">
          <div class="entry-head">
            <span class="entry-title">${esc(r.title)}</span>
            ${r.period ? `<span class="entry-date">${esc(r.period)}</span>` : ""}
          </div>
          ${sub ? `<div class="entry-sub">${sub}</div>` : ""}
          ${bullets}
        </div>`;
    })
    .join("");
  return `<section>${sectionTitle("Experience")}${items}</section>`;
}

function educationHtml(doc: ResumeDoc): string {
  if (!doc.education.length) return "";
  const items = doc.education
    .map((e) => {
      const sub = [e.institution, e.location].filter((x): x is string => Boolean(x)).map(esc).join(" · ");
      return `
        <div class="entry">
          <div class="entry-head">
            <span class="entry-title">${esc(e.degree)}</span>
            ${e.period ? `<span class="entry-date">${esc(e.period)}</span>` : ""}
          </div>
          ${sub ? `<div class="entry-sub">${sub}</div>` : ""}
          ${e.detail ? `<div class="entry-detail">${esc(e.detail)}</div>` : ""}
        </div>`;
    })
    .join("");
  return `<section>${sectionTitle("Education")}${items}</section>`;
}

function skillsHtml(doc: ResumeDoc): string {
  if (!doc.skills.length) return "";
  const groups = doc.skills
    .map(
      (g) => `
      <div class="skill-group">
        <span class="skill-label">${esc(g.name)}</span>
        <span class="skill-items">${g.skills.map((s) => esc(s.name)).join(", ")}</span>
      </div>`
    )
    .join("");
  return `<section>${sectionTitle("Skills")}${groups}</section>`;
}

function projectsHtml(doc: ResumeDoc): string {
  if (!doc.projects.length) return "";
  const items = doc.projects
    .map(
      (p) => `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${
            p.link ? `<a href="${esc(p.link)}">${esc(p.name)}</a>` : esc(p.name)
          }</span>
        </div>
        ${p.description ? `<div class="entry-detail">${esc(p.description)}</div>` : ""}
      </div>`
    )
    .join("");
  return `<section>${sectionTitle("Projects")}${items}</section>`;
}

function certificationsHtml(doc: ResumeDoc): string {
  if (!doc.certifications.length) return "";
  const items = doc.certifications
    .map((c) => {
      const meta = [c.issuer, c.year].filter((x): x is string => Boolean(x)).map(esc).join(" · ");
      return `<li><span class="cert-name">${esc(c.name)}</span>${
        meta ? ` <span class="cert-meta">${meta}</span>` : ""
      }</li>`;
    })
    .join("");
  return `<section>${sectionTitle("Certifications")}<ul class="plain">${items}</ul></section>`;
}

function languagesHtml(doc: ResumeDoc): string {
  if (!doc.languages.length) return "";
  const line = doc.languages
    .map((l) => (l.level ? `${esc(l.name)} (${esc(l.level)})` : esc(l.name)))
    .join("   ·   ");
  return `<section>${sectionTitle("Languages")}<div class="lang-line">${line}</div></section>`;
}

function awardsHtml(doc: ResumeDoc): string {
  if (!doc.awards.length) return "";
  const items = doc.awards.map((a) => `<li>${esc(a)}</li>`).join("");
  return `<section>${sectionTitle("Awards")}<ul>${items}</ul></section>`;
}

function summaryHtml(doc: ResumeDoc): string {
  if (!doc.summary || !doc.summary.trim()) return "";
  return `<section>${sectionTitle("Summary")}<p class="summary">${esc(
    doc.summary
  )}</p></section>`;
}

function htmlDoc(title: string, css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>
  @page { size: Letter; margin: 0.55in 0.6in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${COLOR.paper}; color: ${COLOR.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${SANS}; font-size: 10.2pt; line-height: 1.42; }
  a { color: ${COLOR.accentDeep}; text-decoration: none; }
  ul { margin: 4pt 0 0; padding-left: 15pt; }
  ul.plain { list-style: none; padding-left: 0; }
  li { margin: 1.5pt 0; }
  section { margin-top: 13pt; }
  section:first-of-type { margin-top: 0; }
  .entry { margin-top: 8pt; break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
  .entry-title { font-weight: 600; font-size: 10.8pt; }
  .entry-date { color: ${COLOR.faint}; font-size: 9pt; white-space: nowrap; }
  .entry-sub { color: ${COLOR.muted}; font-size: 9.6pt; margin-top: 1pt; }
  .entry-detail { color: ${COLOR.inkSoft}; font-size: 9.6pt; margin-top: 2pt; }
  .summary { margin: 0; color: ${COLOR.inkSoft}; }
  .skill-group { margin-top: 4pt; font-size: 9.8pt; }
  .skill-label { font-weight: 600; }
  .skill-items { color: ${COLOR.inkSoft}; }
  .cert-meta, .lang-line { color: ${COLOR.muted}; }
  ${css}
  </style></head><body>${body}</body></html>`;
}

// --- templates -------------------------------------------------------------

function renderClassic(doc: ResumeDoc): string {
  const c = doc.contact;
  const css = `
  .head { text-align: center; padding-bottom: 11pt; border-bottom: 1.5pt solid ${COLOR.accent}; }
  .name { font-family: ${SERIF}; font-size: 25pt; font-weight: 600; letter-spacing: 0.5pt; }
  .headline { color: ${COLOR.accentDeep}; font-size: 10pt; font-weight: 600; letter-spacing: 1.2pt; text-transform: uppercase; margin-top: 3pt; }
  .contact { color: ${COLOR.muted}; font-size: 9.4pt; margin-top: 6pt; }
  .contact span.dot { padding: 0 5pt; color: ${COLOR.line}; }
  h2.sec { font-size: 10.5pt; font-weight: 700; letter-spacing: 1.4pt; text-transform: uppercase; color: ${COLOR.ink}; margin: 0 0 6pt; padding-bottom: 3pt; border-bottom: 0.75pt solid ${COLOR.line}; }
  .entry-head { display: block; }
  .entry-date { float: right; }
  `;
  const contact = contactItems(doc).join('<span class="dot">•</span>');
  const body = `
    <div class="head">
      <div class="name">${esc(c.name)}</div>
      ${c.headline ? `<div class="headline">${esc(c.headline)}</div>` : ""}
      ${contact ? `<div class="contact">${contact}</div>` : ""}
    </div>
    <div class="main">
      ${summaryHtml(doc)}
      ${experienceHtml(doc)}
      ${educationHtml(doc)}
      ${skillsHtml(doc)}
      ${projectsHtml(doc)}
      ${certificationsHtml(doc)}
      ${languagesHtml(doc)}
      ${awardsHtml(doc)}
    </div>`;
  return htmlDoc(`${c.name} — Résumé`, css, body);
}

function renderModern(doc: ResumeDoc): string {
  const c = doc.contact;
  const css = `
  .band { background: ${COLOR.band}; color: ${COLOR.bandText}; margin: -0.55in -0.6in 14pt; padding: 24pt 0.6in 18pt; }
  .name { font-size: 26pt; font-weight: 700; letter-spacing: -0.3pt; }
  .headline { color: ${COLOR.bandMuted}; font-size: 11pt; font-weight: 500; margin-top: 4pt; }
  .contact { color: ${COLOR.bandMuted}; font-size: 9.2pt; margin-top: 9pt; }
  .contact a { color: ${COLOR.bandText}; }
  .contact span.dot { padding: 0 5pt; color: rgba(255,255,255,0.25); }
  .cols { display: flex; gap: 22pt; align-items: flex-start; }
  .side { width: 33%; }
  .body { width: 67%; }
  h2.sec { font-size: 9.5pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; color: ${COLOR.accentDeep}; margin: 0 0 6pt; }
  .side section, .body section { margin-top: 14pt; }
  .side section:first-child, .body section:first-child { margin-top: 0; }
  `;
  const contact = contactItems(doc).join('<span class="dot">•</span>');
  const side = `
    ${skillsHtml(doc)}
    ${educationHtml(doc)}
    ${certificationsHtml(doc)}
    ${languagesHtml(doc)}
    ${awardsHtml(doc)}`;
  const main = `
    ${summaryHtml(doc)}
    ${experienceHtml(doc)}
    ${projectsHtml(doc)}`;
  const body = `
    <div class="band">
      <div class="name">${esc(c.name)}</div>
      ${c.headline ? `<div class="headline">${esc(c.headline)}</div>` : ""}
      ${contact ? `<div class="contact">${contact}</div>` : ""}
    </div>
    <div class="cols">
      <div class="side">${side}</div>
      <div class="body">${main}</div>
    </div>`;
  return htmlDoc(`${c.name} — Résumé`, css, body);
}

function renderMinimal(doc: ResumeDoc): string {
  const c = doc.contact;
  const css = `
  body { font-size: 10pt; }
  .head { padding-bottom: 12pt; }
  .name { font-size: 24pt; font-weight: 700; letter-spacing: -0.4pt; }
  .headline { color: ${COLOR.muted}; font-size: 11pt; font-weight: 400; margin-top: 2pt; }
  .contact { color: ${COLOR.muted}; font-size: 9.2pt; margin-top: 8pt; }
  .contact span.dot { padding: 0 6pt; color: ${COLOR.line}; }
  h2.sec { font-size: 8.6pt; font-weight: 700; letter-spacing: 2pt; text-transform: uppercase; color: ${COLOR.faint}; margin: 0 0 5pt; }
  section { margin-top: 16pt; }
  `;
  const contact = contactItems(doc).join('<span class="dot">•</span>');
  const body = `
    <div class="head">
      <div class="name">${esc(c.name)}</div>
      ${c.headline ? `<div class="headline">${esc(c.headline)}</div>` : ""}
      ${contact ? `<div class="contact">${contact}</div>` : ""}
    </div>
    ${summaryHtml(doc)}
    ${experienceHtml(doc)}
    ${educationHtml(doc)}
    ${skillsHtml(doc)}
    ${projectsHtml(doc)}
    ${certificationsHtml(doc)}
    ${languagesHtml(doc)}
    ${awardsHtml(doc)}`;
  return htmlDoc(`${c.name} — Résumé`, css, body);
}

/** Render a structured résumé to a full, print-ready HTML document. */
export function renderResumePage(
  doc: ResumeDoc,
  templateId: ResumePageTemplateId = "classic"
): string {
  switch (templateId) {
    case "modern":
      return renderModern(doc);
    case "minimal":
      return renderMinimal(doc);
    case "classic":
    default:
      return renderClassic(doc);
  }
}
