/**
 * Deterministic résumé carousel — built directly from a structured
 * `ResumeDoc` (see lib/pdf/extract.ts → extractResumeDoc), bypassing the
 * article-tuned structure/planner/render agents entirely.
 *
 * Each section of the resume becomes one square slide drawn with the résumé
 * design system (lib/render/system/resumeChrome.ts): a cover/profile card,
 * an optional summary, paginated experience, grouped skills, education,
 * certifications + languages, and a closing contact card. Returns ready
 * `RenderedPanel`s so the orchestrator can hand them straight to assembly.
 */

import {
  RESUME,
  R_GRID,
  escapeXml as esc,
  fitText,
  footerBlock,
  resumeWrap,
  sectionHeader,
  skillRow,
  wrapToWidth,
} from "./system/resumeChrome";
import type { RenderedPanel, ResumeDoc } from "../shared/schemas";

const { W, H, PAD, CONTENT_W } = R_GRID;
const BODY_BOTTOM = H - 72; // leave room for the footer block

/** One slide's content + metadata, before slide numbers are assigned. */
interface SlideSpec {
  id: string;
  heading: string;
  caption: string;
  /** Draw the slide body; receives the resolved 1-based index + deck total. */
  draw: (index: number, total: number) => string;
}

function panel(spec: SlideSpec, index: number, total: number): RenderedPanel {
  return {
    sectionId: spec.id,
    heading: spec.heading,
    caption: spec.caption,
    format: "svg",
    content: spec.draw(index, total),
    validated: true,
    fallback: false,
    edited: false,
  };
}

/** Build the full ordered résumé deck from a structured ResumeDoc. */
export function buildResumeDeck(doc: ResumeDoc): RenderedPanel[] {
  const specs: SlideSpec[] = [];

  specs.push(coverSlide(doc));
  if (doc.summary && doc.summary.trim()) specs.push(summarySlide(doc.summary));
  specs.push(...experienceSlides(doc));
  if (doc.skills.length) specs.push(skillsSlide(doc));
  if (doc.education.length) specs.push(educationSlide(doc));
  if (doc.certifications.length || doc.languages.length)
    specs.push(certsLanguagesSlide(doc));
  specs.push(contactSlide(doc));

  const total = specs.length;
  return specs.map((s, i) => panel(s, i + 1, total));
}

// ---------------------------------------------------------------- cover

function coverSlide(doc: ResumeDoc): SlideSpec {
  const c = doc.contact;
  const draw = (index: number, total: number) => {
    const bandH = 288;
    const nameFit = fitText(c.name, {
      width: CONTENT_W,
      height: 120,
      minSize: 34,
      maxSize: 58,
      lineHeight: 1.04,
    });
    const nameTop = bandH / 2 - (nameFit.lines.length * nameFit.size * 1.04) / 2 + 4;
    const nameEls = nameFit.lines
      .map(
        (l, i) =>
          `<text x="${PAD}" y="${(nameTop + (i + 1) * nameFit.size * 1.04).toFixed(
            1
          )}" font-size="${nameFit.size}" font-weight="700" letter-spacing="-0.02em" fill="${RESUME.bandText}">${esc(
            l
          )}</text>`
      )
      .join("");

    const headlineEl = c.headline
      ? `<text x="${PAD}" y="${bandH - 34}" font-size="17" font-weight="500" letter-spacing="0.01em" fill="${RESUME.bandMuted}">${esc(
          c.headline
        )}</text>`
      : "";

    // Contact rows on the paper field below the band.
    const rows: Array<[string, string]> = [];
    if (c.email) rows.push(["Email", c.email]);
    if (c.phone) rows.push(["Phone", c.phone]);
    if (c.location) rows.push(["Location", c.location]);
    for (const link of c.links.slice(0, 4 - Math.min(rows.length, 3)))
      rows.push([link.label, link.url]);

    let cy = bandH + 64;
    const rowEls = rows
      .slice(0, 5)
      .map(([k, v]) => {
        const el = `
        <circle cx="${PAD + 4}" cy="${cy - 5}" r="3" fill="${RESUME.bronze}"/>
        <text x="${PAD + 22}" y="${cy}" font-size="12" font-weight="600" letter-spacing="0.1em" fill="${RESUME.inkMuted}">${esc(
          k.toUpperCase()
        )}</text>
        <text x="${PAD + 150}" y="${cy}" font-size="16" font-weight="500" fill="${RESUME.ink}">${esc(
          truncate(v, 42)
        )}</text>`;
        cy += 42;
        return el;
      })
      .join("");

    return resumeWrap(
      `
      <rect x="0" y="0" width="${W}" height="${bandH}" fill="${RESUME.band}"/>
      <rect x="${PAD}" y="56" width="48" height="6" rx="3" fill="${RESUME.bronze}"/>
      <text x="${PAD}" y="86" font-size="13" font-weight="600" letter-spacing="0.22em" fill="${RESUME.bandMuted}">RÉSUMÉ</text>
      ${nameEls}
      ${headlineEl}
      ${rowEls}
      ${footerBlock({ name: c.name, index, total })}
    `,
      { title: `${c.name} — Résumé` }
    );
  };
  return {
    id: "resume-cover",
    heading: c.name,
    caption: c.headline ?? `Résumé of ${c.name}`,
    draw,
  };
}

// -------------------------------------------------------------- summary

function summarySlide(summary: string): SlideSpec {
  const draw = (index: number, total: number) => {
    const { svg, bottom } = sectionHeader({ kicker: "Profile", title: "Summary" });
    const fit = fitText(summary, {
      width: CONTENT_W,
      height: BODY_BOTTOM - bottom,
      minSize: 16,
      maxSize: 24,
      lineHeight: 1.5,
    });
    const startY = bottom + fit.size;
    const lines = fit.lines
      .map(
        (l, i) =>
          `<text x="${PAD}" y="${(startY + i * fit.size * 1.5).toFixed(1)}" font-size="${fit.size}" font-weight="400" fill="${RESUME.inkSoft}">${esc(
            l
          )}</text>`
      )
      .join("");
    return resumeWrap(
      `${svg}${lines}${footerBlock({ name: "Summary", index, total })}`,
      { title: "Summary" }
    );
  };
  return {
    id: "resume-summary",
    heading: "Summary",
    caption: truncate(summary, 140),
    draw,
  };
}

// ----------------------------------------------------------- experience

interface RoleBlock {
  role: ResumeDoc["experience"][number];
  bulletLines: string[][];
  height: number;
}

function measureRole(role: ResumeDoc["experience"][number]): RoleBlock {
  const bulletLines = role.bullets
    .slice(0, 4)
    .map((b) => wrapToWidth(b, CONTENT_W - 24, 14).slice(0, 2));
  const bulletsH = bulletLines.reduce((a, ls) => a + ls.length * 20, 0);
  // period(18) + title(26) + company(22) + bullets + gap(22)
  const height = 18 + 26 + 22 + bulletsH + 24;
  return { role, bulletLines, height };
}

function experienceSlides(doc: ResumeDoc): SlideSpec[] {
  if (!doc.experience.length) return [];
  const blocks = doc.experience.slice(0, 8).map(measureRole);

  // Pack roles onto pages within the body budget.
  const pages: RoleBlock[][] = [];
  let cur: RoleBlock[] = [];
  let used = 0;
  const budget = BODY_BOTTOM - (PAD + 88); // header bottom ≈ PAD+88
  for (const b of blocks) {
    if (cur.length && used + b.height > budget) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(b);
    used += b.height;
  }
  if (cur.length) pages.push(cur);

  return pages.map((pageBlocks, pi) => {
    const draw = (index: number, total: number) => {
      const { svg, bottom } = sectionHeader({
        kicker: pages.length > 1 ? `Experience ${pi + 1}/${pages.length}` : "Experience",
        title: "Experience",
      });
      let y = bottom + 16;
      const parts: string[] = [];
      for (const { role, bulletLines } of pageBlocks) {
        if (role.period) {
          parts.push(
            `<text x="${PAD}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.1em" fill="${RESUME.bronzeDeep}">${esc(
              role.period.toUpperCase()
            )}</text>`
          );
        }
        y += 24;
        parts.push(
          `<text x="${PAD}" y="${y}" font-size="19" font-weight="600" fill="${RESUME.ink}">${esc(
            truncate(role.title, 44)
          )}</text>`
        );
        y += 22;
        const companyLine = role.location
          ? `${role.company} · ${role.location}`
          : role.company;
        parts.push(
          `<text x="${PAD}" y="${y}" font-size="14" font-weight="500" fill="${RESUME.inkMuted}">${esc(
            truncate(companyLine, 52)
          )}</text>`
        );
        y += 22;
        for (const ls of bulletLines) {
          parts.push(
            `<circle cx="${PAD + 4}" cy="${y - 4}" r="2" fill="${RESUME.bronze}"/>`
          );
          ls.forEach((line, li) => {
            parts.push(
              `<text x="${PAD + 18}" y="${y + li * 20}" font-size="14" font-weight="400" fill="${RESUME.inkSoft}">${esc(
                line
              )}</text>`
            );
          });
          y += ls.length * 20;
        }
        y += 22;
      }
      return resumeWrap(
        `${svg}${parts.join("")}${footerBlock({ name: "Experience", index, total })}`,
        { title: "Experience" }
      );
    };
    return {
      id: `resume-experience-${pi + 1}`,
      heading: "Experience",
      caption: pageBlocks
        .map((b) => `${b.role.title} · ${b.role.company}`)
        .join("  ·  ")
        .slice(0, 140),
      draw,
    };
  });
}

// --------------------------------------------------------------- skills

function skillsSlide(doc: ResumeDoc): SlideSpec {
  const draw = (index: number, total: number) => {
    const { svg, bottom } = sectionHeader({ kicker: "Expertise", title: "Skills" });
    const colW = (CONTENT_W - 40) / 2;
    const colX = [PAD, PAD + colW + 40];
    const colY = [bottom + 20, bottom + 20];
    const parts: string[] = [];
    doc.skills.slice(0, 6).forEach((g, gi) => {
      const col = gi % 2;
      let y = colY[col];
      parts.push(
        `<text x="${colX[col]}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.12em" fill="${RESUME.inkMuted}">${esc(
          g.name.toUpperCase()
        )}</text>`
      );
      y += 28;
      for (const s of g.skills.slice(0, 6)) {
        parts.push(
          skillRow({ x: colX[col], y, width: colW, name: truncate(s.name, 26), level: s.level })
        );
        y += s.level ? 30 : 24;
      }
      y += 14;
      colY[col] = y;
    });
    return resumeWrap(
      `${svg}${parts.join("")}${footerBlock({ name: "Skills", index, total })}`,
      { title: "Skills" }
    );
  };
  return {
    id: "resume-skills",
    heading: "Skills",
    caption: doc.skills
      .map((g) => g.name)
      .join(" · ")
      .slice(0, 140),
    draw,
  };
}

// ------------------------------------------------------------ education

function educationSlide(doc: ResumeDoc): SlideSpec {
  const draw = (index: number, total: number) => {
    const { svg, bottom } = sectionHeader({ kicker: "Background", title: "Education" });
    let y = bottom + 24;
    const parts: string[] = [];
    for (const e of doc.education.slice(0, 4)) {
      if (e.period) {
        parts.push(
          `<text x="${PAD}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.1em" fill="${RESUME.bronzeDeep}">${esc(
            e.period.toUpperCase()
          )}</text>`
        );
      }
      y += 24;
      parts.push(
        `<text x="${PAD}" y="${y}" font-size="19" font-weight="600" fill="${RESUME.ink}">${esc(
          truncate(e.degree, 46)
        )}</text>`
      );
      y += 22;
      const inst = e.location ? `${e.institution} · ${e.location}` : e.institution;
      parts.push(
        `<text x="${PAD}" y="${y}" font-size="14" font-weight="500" fill="${RESUME.inkMuted}">${esc(
          truncate(inst, 54)
        )}</text>`
      );
      y += 22;
      if (e.detail) {
        for (const line of wrapToWidth(e.detail, CONTENT_W, 14).slice(0, 2)) {
          parts.push(
            `<text x="${PAD}" y="${y}" font-size="14" font-weight="400" fill="${RESUME.inkSoft}">${esc(
              line
            )}</text>`
          );
          y += 20;
        }
      }
      y += 24;
    }
    return resumeWrap(
      `${svg}${parts.join("")}${footerBlock({ name: "Education", index, total })}`,
      { title: "Education" }
    );
  };
  return {
    id: "resume-education",
    heading: "Education",
    caption: doc.education
      .map((e) => `${e.degree} · ${e.institution}`)
      .join("  ·  ")
      .slice(0, 140),
    draw,
  };
}

// ------------------------------------------------- certifications + languages

function certsLanguagesSlide(doc: ResumeDoc): SlideSpec {
  const draw = (index: number, total: number) => {
    const { svg, bottom } = sectionHeader({
      kicker: "Credentials",
      title: doc.certifications.length ? "Certifications" : "Languages",
    });
    let y = bottom + 24;
    const parts: string[] = [];
    if (doc.certifications.length) {
      for (const c of doc.certifications.slice(0, 6)) {
        parts.push(
          `<circle cx="${PAD + 4}" cy="${y - 5}" r="3" fill="${RESUME.bronze}"/>`
        );
        const meta = [c.issuer, c.year].filter(Boolean).join(" · ");
        parts.push(
          `<text x="${PAD + 20}" y="${y}" font-size="16" font-weight="500" fill="${RESUME.ink}">${esc(
            truncate(c.name, 48)
          )}</text>`
        );
        y += 22;
        if (meta) {
          parts.push(
            `<text x="${PAD + 20}" y="${y}" font-size="13" font-weight="400" fill="${RESUME.inkMuted}">${esc(
              truncate(meta, 52)
            )}</text>`
          );
          y += 22;
        }
        y += 6;
      }
      y += 16;
    }
    if (doc.languages.length) {
      parts.push(
        `<text x="${PAD}" y="${y}" font-size="12" font-weight="600" letter-spacing="0.12em" fill="${RESUME.inkMuted}">LANGUAGES</text>`
      );
      y += 26;
      const langLine = doc.languages
        .slice(0, 8)
        .map((l) => (l.level ? `${l.name} (${l.level})` : l.name))
        .join("   ·   ");
      for (const line of wrapToWidth(langLine, CONTENT_W, 16).slice(0, 3)) {
        parts.push(
          `<text x="${PAD}" y="${y}" font-size="16" font-weight="500" fill="${RESUME.inkSoft}">${esc(
            line
          )}</text>`
        );
        y += 26;
      }
    }
    return resumeWrap(
      `${svg}${parts.join("")}${footerBlock({ name: "Credentials", index, total })}`,
      { title: "Credentials" }
    );
  };
  return {
    id: "resume-credentials",
    heading: "Credentials",
    caption: [...doc.certifications.map((c) => c.name), ...doc.languages.map((l) => l.name)]
      .join(" · ")
      .slice(0, 140),
    draw,
  };
}

// -------------------------------------------------------------- contact

function contactSlide(doc: ResumeDoc): SlideSpec {
  const c = doc.contact;
  const draw = (index: number, total: number) => {
    const bandTop = 0;
    const lines: Array<[string, string]> = [];
    if (c.email) lines.push(["Email", c.email]);
    if (c.phone) lines.push(["Phone", c.phone]);
    if (c.location) lines.push(["Location", c.location]);
    for (const link of c.links.slice(0, 4)) lines.push([link.label, link.url]);

    let cy = 300;
    const rowEls = lines
      .slice(0, 5)
      .map(([k, v]) => {
        const el = `
        <text x="${PAD}" y="${cy}" font-size="12" font-weight="600" letter-spacing="0.12em" fill="${RESUME.bandMuted}">${esc(
          k.toUpperCase()
        )}</text>
        <text x="${PAD + 150}" y="${cy}" font-size="17" font-weight="500" fill="${RESUME.bandText}">${esc(
          truncate(v, 42)
        )}</text>`;
        cy += 40;
        return el;
      })
      .join("");

    return resumeWrap(
      `
      <rect x="0" y="${bandTop}" width="${W}" height="${H}" fill="${RESUME.band}"/>
      <rect x="${PAD}" y="120" width="48" height="6" rx="3" fill="${RESUME.bronze}"/>
      <text x="${PAD}" y="172" font-size="40" font-weight="700" letter-spacing="-0.01em" fill="${RESUME.bandText}">Let’s connect.</text>
      <text x="${PAD}" y="208" font-size="16" font-weight="500" fill="${RESUME.bandMuted}">${esc(
        c.headline ? truncate(c.headline, 60) : c.name
      )}</text>
      ${rowEls}
      ${footerBlock({ name: c.name, index, total, onDark: true })}
    `,
      { bg: RESUME.band, title: "Contact" }
    );
  };
  return {
    id: "resume-contact",
    heading: "Let’s connect",
    caption: `Reach ${c.name}${c.email ? ` at ${c.email}` : ""}`.slice(0, 140),
    draw,
  };
}

// ---------------------------------------------------------------- utils

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}
