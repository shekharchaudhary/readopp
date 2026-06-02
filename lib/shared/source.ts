/**
 * Source URL helpers. A source can be either a real http(s) URL (the original
 * ingest path) or a synthetic `upload://<filename>` URL (PDF upload path).
 */

export function isUploadSource(url: string): boolean {
  return url.startsWith("upload://");
}

export function uploadFilename(url: string): string {
  if (!isUploadSource(url)) return url;
  // upload://my-resume.pdf  →  my-resume.pdf
  return url.slice("upload://".length) || "uploaded file";
}

/**
 * Short, human-readable label for a source:
 *   https://example.com/...      → "example.com"
 *   upload://my-paper.pdf        → "my-paper.pdf"
 *   <unparseable>                → the original string
 */
export function sourceLabel(url: string): string {
  if (isUploadSource(url)) return uploadFilename(url);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Whether the URL is safe to use as an <a href>. False for upload://. */
export function sourceIsLinkable(url: string): boolean {
  return !isUploadSource(url);
}
