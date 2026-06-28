import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { callMessages, MODEL_STRONG } from "../anthropic";
import { IngestError } from "../ingest";
import {
  CleanArticleSchema,
  ResumeDocSchema,
  type CleanArticle,
  type ResumeDoc,
} from "../shared/schemas";

// The Anthropic API supports `{ type: "document", source: { type: "base64",
// media_type: "application/pdf", data: <b64> } }` content blocks. The version
// of the SDK we're on (0.32) doesn't include this in its TypeScript types, so
// we cast the content array. Bumping the SDK is a separate change.
type ContentBlock = MessageCreateParamsNonStreaming["messages"][number]["content"];

/**
 * Extract a CleanArticle from a PDF buffer by passing the PDF directly to
 * Claude as a document block. Claude does the heavy lifting (multi-column
 * reflow, header/footer stripping, table-to-prose) — much higher quality
 * than client-side pdf-parse for papers / resumes / scanned PDFs.
 *
 * The fake "url" field becomes `upload://<filename>` so downstream code
 * (cache key, display, exports) can still reference a string source.
 */
export async function extractPdfArticle(input: {
  buffer: Buffer;
  filename: string;
  /** Optional job id for usage attribution. */
  jobId?: string;
}): Promise<CleanArticle> {
  const { buffer, filename, jobId } = input;
  if (buffer.length === 0) {
    throw new IngestError({
      reason: "empty_content",
      message: "PDF is empty.",
    });
  }

  const base64 = buffer.toString("base64");
  const fakeUrl = `upload://${filename}`;

  const SYSTEM_PROMPT = `
You are the ingest stage for a visual-explainer pipeline. You receive a PDF
(article, paper, resume, book chapter, archive) and must return CLEAN ARTICLE
JSON ready for the comprehension agent.

Extract:
- title: the document's true title (not the filename). For a paper, this is the
  paper title. For a resume, "<name>'s resume". For a book chapter, the
  chapter title. Use sentence case unless the original is clearly capitalised.
- byline: author(s) if clearly named; otherwise omit.
- publishedAt: ISO date if clearly stated in the document; otherwise omit.
- text: the main body as PROSE. Reflow multi-column layout into a single
  reading order. Drop running headers, footers, page numbers, table-of-
  contents lines, and reference lists. Keep section headings inline as plain
  sentences. Convert tables to short paragraphs ("The 2024 column shows X,
  while 2023 was Y..."). Inline figure captions where they belong in the flow.
  Do NOT add anything not in the source. Aim for the natural reading text —
  for a 12-page paper that's typically 2,500–5,000 words.
- wordCount: integer word count of the text field.
- codeBlocks: empty array (we don't need these from PDFs).
- imageUrls: empty array.

Respond with ONLY JSON of this shape (no fences, no commentary):
{
  "url": "${fakeUrl}",
  "title": "...",
  "byline": "...",        // optional
  "publishedAt": "...",   // optional ISO date
  "text": "...",
  "codeBlocks": [],
  "imageUrls": [],
  "wordCount": 1234
}
`.trim();

  let parsed: unknown;
  try {
    const res = await callMessages(
      {
        model: MODEL_STRONG,
        max_tokens: 16_384,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `Filename: ${filename}\n\nExtract this PDF as a CleanArticle. Return ONLY the JSON object.`,
              },
            ] as unknown as ContentBlock,
          },
        ],
      },
      { jobId, label: "ingest[pdf]" }
    );

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Strip accidental markdown fences just in case.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/api key|401|403/i.test(msg)) {
      throw new IngestError({
        reason: "unknown",
        message: "Anthropic API rejected the request — check ANTHROPIC_API_KEY.",
      });
    }
    throw new IngestError({
      reason: "empty_content",
      message: `Could not extract text from PDF: ${msg.slice(0, 200)}`,
    });
  }

  // Force the synthetic URL and empty arrays regardless of what the model returned.
  const obj = (parsed ?? {}) as Record<string, unknown>;
  obj.url = fakeUrl;
  obj.codeBlocks = Array.isArray(obj.codeBlocks) ? obj.codeBlocks : [];
  obj.imageUrls = Array.isArray(obj.imageUrls) ? obj.imageUrls : [];
  if (typeof obj.text !== "string" || !obj.text.trim()) {
    throw new IngestError({
      reason: "empty_content",
      message: "PDF extraction returned no readable text.",
    });
  }
  if (typeof obj.wordCount !== "number" || !Number.isFinite(obj.wordCount)) {
    obj.wordCount = (obj.text as string).trim().split(/\s+/).length;
  }
  if (typeof obj.title !== "string" || !obj.title.trim()) {
    obj.title = filename.replace(/\.pdf$/i, "");
  }

  return CleanArticleSchema.parse(obj);
}

/**
 * Extract a structured `ResumeDoc` from a resume/CV PDF. Where
 * `extractPdfArticle` flattens a document to reading-order prose, this keeps
 * the resume's *structure* — contact block, dated roles with bullets, grouped
 * skills, education, certifications, languages, projects — so the render layer
 * can rebuild a real resume (single-page builder) or a resume-styled carousel.
 *
 * Only call this once the document is known to be a resume (genre === "resume").
 * The PDF goes in as a document block, same as the article path; the model
 * returns ONE JSON object matching ResumeDocSchema.
 */
export async function extractResumeDoc(input: {
  buffer: Buffer;
  filename: string;
  jobId?: string;
}): Promise<ResumeDoc> {
  const { buffer, filename, jobId } = input;
  if (buffer.length === 0) {
    throw new IngestError({ reason: "empty_content", message: "PDF is empty." });
  }

  const base64 = buffer.toString("base64");

  const SYSTEM_PROMPT = `
You are the resume-parsing stage for a visual resume pipeline. You receive a
resume / CV PDF and must return STRUCTURED RESUME JSON. Extract only what is
present in the document — never invent roles, dates, skills, or contact info.
Normalise lightly (consistent date ranges like "2021–Present", trimmed bullets)
but do not editorialise.

Fields:
- contact.name: the person's full name (required).
- contact.headline: their professional title / tagline if present (e.g.
  "Senior Software Engineer"); otherwise omit.
- contact.email, contact.phone, contact.location: if clearly present; else omit.
- contact.links: array of { label, url } for LinkedIn / GitHub / portfolio /
  personal site. Label is the human name ("GitHub"), url is the address.
- summary: the profile / objective / about paragraph, if present (<= 600 chars).
- experience: array of roles, most recent first. Each:
    { title, company, location?, period?, bullets[] }
  period is the date range as written ("2021–Present"). bullets are the
  achievement lines (<= 6), trimmed, no leading dashes.
- education: array of { degree, institution, location?, period?, detail? }.
  detail is GPA / honours / thesis if stated.
- skills: array of groups { name, skills[] }. Bucket skills under their heading
  ("Languages", "Tools", "Design"). If the resume lists skills ungrouped, use a
  single group named "Skills". Each skill is { name, level? } where level is
  "expert" | "strong" | "familiar" ONLY if the resume signals proficiency
  (bars, dots, "expert in") — otherwise omit level.
- certifications: array of { name, issuer?, year? }.
- languages: array of { name, level? } (level like "Native", "Fluent", "B2").
- projects: array of { name, description?, link? }.
- awards: array of short strings.

Omit any section that isn't in the resume (leave its array empty / field unset).
Respond with ONLY the JSON object — no code fences, no commentary.
`.trim();

  let parsed: unknown;
  try {
    const res = await callMessages(
      {
        model: MODEL_STRONG,
        max_tokens: 8_192,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `Filename: ${filename}\n\nParse this resume into ResumeDoc JSON. Return ONLY the JSON object.`,
              },
            ] as unknown as ContentBlock,
          },
        ],
      },
      { jobId, label: "ingest[resume]" }
    );

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/api key|401|403/i.test(msg)) {
      throw new IngestError({
        reason: "unknown",
        message: "Anthropic API rejected the request — check ANTHROPIC_API_KEY.",
      });
    }
    throw new IngestError({
      reason: "empty_content",
      message: `Could not parse resume from PDF: ${msg.slice(0, 200)}`,
    });
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const contact = (obj.contact ?? {}) as Record<string, unknown>;
  if (typeof contact.name !== "string" || !contact.name.trim()) {
    // A resume with no recoverable name isn't usable structurally; fall back
    // to the filename so the schema's required `contact.name` still parses.
    contact.name = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    obj.contact = contact;
  }

  // The schema's array/string caps are design limits, not validation rules —
  // a real CV legitimately lists more than 6 skill groups or a long bullet.
  // Clamp the model output to those caps so a large-but-valid resume renders
  // instead of throwing a ZodError (which would silently drop it back to the
  // article path). Mirrors the render layer, which slices to the same limits.
  return ResumeDocSchema.parse(clampResumeDoc(obj));
}

// --- ResumeDoc normalisation helpers -------------------------------------

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Coerce a raw parsed resume object so it always satisfies ResumeDocSchema:
 * truncate over-long strings, slice over-long arrays, and drop entries that
 * can't satisfy a required (`min(1)`) field rather than letting them reject
 * the whole document.
 */
function clampResumeDoc(obj: Record<string, unknown>): Record<string, unknown> {
  const c = (obj.contact ?? {}) as Record<string, unknown>;
  const contact = {
    name: str(c.name, 80) ?? "Candidate",
    headline: str(c.headline, 120),
    email: str(c.email, 120),
    phone: str(c.phone, 40),
    location: str(c.location, 80),
    links: arr(c.links)
      .map((l) => {
        const r = (l ?? {}) as Record<string, unknown>;
        const label = str(r.label, 40);
        const url = str(r.url, 200);
        return label && url ? { label, url } : null;
      })
      .filter(Boolean)
      .slice(0, 6),
  };

  const experience = arr(obj.experience)
    .map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      const title = str(r.title, 80);
      const company = str(r.company, 80);
      if (!title || !company) return null;
      return {
        title,
        company,
        location: str(r.location, 60),
        period: str(r.period, 40),
        bullets: arr(r.bullets)
          .map((b) => str(b, 220))
          .filter(Boolean)
          .slice(0, 6),
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  const education = arr(obj.education)
    .map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      const degree = str(r.degree, 100);
      const institution = str(r.institution, 100);
      if (!degree || !institution) return null;
      return {
        degree,
        institution,
        location: str(r.location, 60),
        period: str(r.period, 40),
        detail: str(r.detail, 160),
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  const levels = new Set(["expert", "strong", "familiar"]);
  const skills = arr(obj.skills)
    .map((g) => {
      const r = (g ?? {}) as Record<string, unknown>;
      const name = str(r.name, 40);
      const items = arr(r.skills)
        .map((s) => {
          const sr = (s ?? {}) as Record<string, unknown>;
          const sname = str(sr.name, 40);
          if (!sname) return null;
          const level =
            typeof sr.level === "string" && levels.has(sr.level)
              ? sr.level
              : undefined;
          return level ? { name: sname, level } : { name: sname };
        })
        .filter(Boolean)
        .slice(0, 12);
      if (!name || items.length === 0) return null;
      return { name, skills: items };
    })
    .filter(Boolean)
    .slice(0, 6);

  const certifications = arr(obj.certifications)
    .map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      const name = str(r.name, 100);
      if (!name) return null;
      return { name, issuer: str(r.issuer, 80), year: str(r.year, 12) };
    })
    .filter(Boolean)
    .slice(0, 8);

  const languages = arr(obj.languages)
    .map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      const name = str(r.name, 40);
      if (!name) return null;
      return { name, level: str(r.level, 40) };
    })
    .filter(Boolean)
    .slice(0, 8);

  const projects = arr(obj.projects)
    .map((x) => {
      const r = (x ?? {}) as Record<string, unknown>;
      const name = str(r.name, 80);
      if (!name) return null;
      return {
        name,
        description: str(r.description, 200),
        link: str(r.link, 200),
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  const awards = arr(obj.awards)
    .map((a) => str(a, 120))
    .filter(Boolean)
    .slice(0, 6);

  return {
    contact,
    summary: str(obj.summary, 600),
    experience,
    education,
    skills,
    certifications,
    languages,
    projects,
    awards,
  };
}
