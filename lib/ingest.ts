import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { CleanArticle, JobError } from "./shared/schemas";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 Readopp/0.1";

const FETCH_TIMEOUT_MS = 15_000;

export class IngestError extends Error {
  readonly error: JobError;
  constructor(error: JobError) {
    super(error.message);
    this.error = error;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new IngestError({
        reason: "login_required",
        message:
          "This page requires a login and can't be read anonymously.",
      });
    }
    if (res.status === 404) {
      throw new IngestError({
        reason: "fetch_failed",
        message: "The article URL returned 404 — it may have moved.",
      });
    }
    if (!res.ok) {
      throw new IngestError({
        reason: "fetch_failed",
        message: `The page returned HTTP ${res.status}.`,
      });
    }
    return await res.text();
  } catch (err) {
    if (err instanceof IngestError) throw err;
    const aborted =
      (err as Error)?.name === "AbortError" ||
      (err as Error)?.message?.includes("aborted");
    if (aborted) {
      throw new IngestError({
        reason: "timeout",
        message: "Took too long to fetch the article.",
      });
    }
    throw new IngestError({
      reason: "fetch_failed",
      message: "Could not fetch the URL. Is it public and reachable?",
    });
  } finally {
    clearTimeout(t);
  }
}

const PAYWALL_HINTS = [
  "subscribe to continue",
  "subscribers only",
  "subscribe to read",
  "to continue reading",
  "create a free account",
  "metered paywall",
];

function detectPaywall(text: string): boolean {
  const lower = text.toLowerCase();
  return PAYWALL_HINTS.some((h) => lower.includes(h));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractCodeBlocks(doc: Document): string[] {
  const out: string[] = [];
  doc.querySelectorAll("pre, code").forEach((el) => {
    const text = el.textContent?.trim() ?? "";
    if (text.length > 20) out.push(text);
  });
  // Dedupe shorter snippets contained in longer ones
  return Array.from(new Set(out));
}

function extractImageUrls(doc: Document, baseUrl: string): string[] {
  const out: string[] = [];
  doc.querySelectorAll("figure img, article img").forEach((el) => {
    const src = el.getAttribute("src");
    if (!src) return;
    try {
      out.push(new URL(src, baseUrl).toString());
    } catch {
      // skip
    }
  });
  return Array.from(new Set(out)).slice(0, 12);
}

export async function ingestUrl(url: string): Promise<CleanArticle> {
  if (!isValidHttpUrl(url)) {
    throw new IngestError({
      reason: "invalid_url",
      message: "That doesn't look like a valid http(s) URL.",
    });
  }

  const html = await fetchHtml(url);

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Heuristic: detect login-wall by HTML cues (e.g. cookie/login forms with no article body)
  const reader = new Readability(doc.cloneNode(true) as Document);
  const article = reader.parse();

  if (!article || !article.textContent) {
    if (detectPaywall(doc.body?.textContent ?? "")) {
      throw new IngestError({
        reason: "paywalled",
        message:
          "This article seems to be behind a paywall and can't be read.",
      });
    }
    throw new IngestError({
      reason: "empty_content",
      message: "Couldn't extract readable content from this page.",
    });
  }

  const text = article.textContent.trim();
  const words = countWords(text);

  if (words < 80) {
    if (detectPaywall(text)) {
      throw new IngestError({
        reason: "paywalled",
        message:
          "This article seems to be behind a paywall — only the preview was readable.",
      });
    }
    throw new IngestError({
      reason: "empty_content",
      message:
        "The page didn't have enough readable text to produce an explainer.",
    });
  }

  return {
    url,
    title: (article.title || doc.title || "Untitled").trim(),
    byline: article.byline?.trim() || undefined,
    publishedAt: undefined,
    text,
    codeBlocks: extractCodeBlocks(doc),
    imageUrls: extractImageUrls(doc, url),
    wordCount: words,
  };
}
