import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { callMessages, MODEL_STRONG } from "../anthropic";
import { IngestError } from "../ingest";
import { CleanArticleSchema, type CleanArticle } from "../shared/schemas";

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
