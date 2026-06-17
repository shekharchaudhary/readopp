import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { getBrowser } from "./playwright";
import type { CleanArticle, JobError } from "./shared/schemas";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 Readopp/0.1";

const FETCH_TIMEOUT_MS = 15_000;
const RENDER_TIMEOUT_MS = 25_000;
// Word threshold under which we consider raw-HTML extraction "too thin" and
// retry by rendering the page in Chromium (handles JS-heavy SPAs).
const MIN_WORDS_BEFORE_FALLBACK = 80;

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

interface FetchResult {
  html: string;
  /** Set on 401/403. Caller may retry via Playwright before surfacing this
      to the user — bot-detection layers (Cloudflare, etc.) often gate the
      raw HTTP fetcher but serve a full page to a real browser. */
  authBlocked?: boolean;
}

async function fetchHtml(url: string): Promise<FetchResult> {
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
      // Return a sentinel so ingestUrl can attempt the Playwright fallback
      // before surfacing login_required to the user.
      return { html: "", authBlocked: true };
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
    return { html: await res.text() };
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

/**
 * Fallback path for JS-rendered sites. Loads the page in headless Chromium,
 * waits for network idle, and returns the post-hydration DOM. Used only when
 * the raw HTML returns less than MIN_WORDS_BEFORE_FALLBACK readable words.
 */
async function fetchHtmlRendered(url: string): Promise<string> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: true,
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT_MS,
    });
    return await page.content();
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
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

interface Parsed {
  doc: Document;
  text: string;
  title: string;
  byline?: string;
  words: number;
}

function parseArticleFromHtml(html: string, url: string): Parsed | null {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const reader = new Readability(doc.cloneNode(true) as Document);
  const article = reader.parse();
  if (!article || !article.textContent) return null;
  const text = article.textContent.trim();
  return {
    doc,
    text,
    title: (article.title || doc.title || "Untitled").trim(),
    byline: article.byline?.trim() || undefined,
    words: countWords(text),
  };
}

export async function ingestUrl(url: string): Promise<CleanArticle> {
  if (!isValidHttpUrl(url)) {
    throw new IngestError({
      reason: "invalid_url",
      message: "That doesn't look like a valid http(s) URL.",
    });
  }

  // Fast path — plain HTTP fetch + Readability.
  const fetchResult = await fetchHtml(url);
  let html = fetchResult.html;
  let parsed = fetchResult.authBlocked ? null : parseArticleFromHtml(html, url);

  // Fallback path — fire whenever extraction was thin OR the raw fetch was
  // auth-blocked. Bot-detection layers like Cloudflare commonly 403 a plain
  // fetch but serve full content to a real browser, so we only surface
  // login_required after Playwright can't read it either.
  const needsRender =
    fetchResult.authBlocked ||
    !parsed ||
    parsed.words < MIN_WORDS_BEFORE_FALLBACK;
  if (needsRender) {
    try {
      // eslint-disable-next-line no-console
      console.log("[readopp] ingest falling back to JS render", {
        url,
        authBlocked: fetchResult.authBlocked ?? false,
      });
      html = await fetchHtmlRendered(url);
      const rendered = parseArticleFromHtml(html, url);
      if (rendered && rendered.words >= MIN_WORDS_BEFORE_FALLBACK) {
        parsed = rendered;
      } else if (rendered && (!parsed || rendered.words > parsed.words)) {
        // Render yielded more text than raw HTML even if still under
        // threshold — prefer it so paywall detection runs against the
        // richer copy.
        parsed = rendered;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[readopp] JS-render fallback failed", {
        url,
        error: (e as Error).message,
      });
      // Fall through — we'll surface the auth-block or empty-content error
      // depending on what state we ended up in.
    }
  }

  if (!parsed) {
    // Raw fetch was auth-blocked AND Playwright also couldn't extract a
    // readable article — surface login_required so the user knows why.
    if (fetchResult.authBlocked) {
      throw new IngestError({
        reason: "login_required",
        message:
          "This page requires a login and can't be read anonymously.",
      });
    }
    throw new IngestError({
      reason: "empty_content",
      message: "Couldn't extract readable content from this page.",
    });
  }

  if (parsed.words < MIN_WORDS_BEFORE_FALLBACK) {
    if (detectPaywall(parsed.text)) {
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
    title: parsed.title,
    byline: parsed.byline,
    publishedAt: undefined,
    text: parsed.text,
    codeBlocks: extractCodeBlocks(parsed.doc),
    imageUrls: extractImageUrls(parsed.doc, url),
    wordCount: parsed.words,
  };
}
