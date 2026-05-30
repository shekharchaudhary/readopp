# Agent 1 — Ingest

**Job:** fetch the URL and return clean article content. This agent is mostly code, not LLM — use an LLM only as a fallback cleaner if the readability extractor produces garbage.

**Model tier:** fast (and ideally no LLM call at all on the happy path).

**Input:** `{ url: string }`
**Output:** `CleanArticle` (see DATA_CONTRACTS.md)

## Procedure

1. Validate URL (must be http/https, public). On failure → `JobError.reason = 'invalid_url'`.
2. Fetch with a real User-Agent and a timeout (~15s). Follow redirects.
3. Detect blockers:
   - HTTP 401/403 or login form markers → `login_required`.
   - Known paywall markers / truncated content + "subscribe" CTA → `paywalled`.
   - 404/5xx → `fetch_failed`.
4. Extract main content with a readability library (Mozilla Readability via jsdom, or a hosted reader API like Jina/Firecrawl for hard cases). Strip nav, ads, footers, comments.
5. Pull out: title, byline, publish date (if present), main text, fenced code blocks, and `<figure>`/diagram image URLs (URLs only — we don't re-host).
6. If extracted text is < ~120 words and the page clearly had content, retry with the hosted reader fallback. If still empty → `empty_content`.
7. Emit `agent.progress` lines: "Fetching article…", then "Stripped nav & ads, N words".

## LLM fallback (only if needed)

If extraction yields messy text (boilerplate mixed in), make ONE fast-model call:

> System: You clean scraped web article text. Remove navigation, ads, cookie notices, social buttons, and unrelated boilerplate. Preserve the article body, headings, and any code blocks. Return ONLY the cleaned article as markdown. Do not summarize or rewrite — only remove non-article cruft.

## Notes

- Respect robots and terms; only fetch user-provided public URLs.
- Do not store full article text longer than needed for the job (privacy). Persisting the finished explainer is fine; persisting raw scraped articles long-term is not necessary.
