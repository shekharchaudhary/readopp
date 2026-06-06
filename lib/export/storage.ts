import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Storage abstraction for export artifacts (PNGs, ZIPs). Two backends:
 *
 *  - Vercel Blob: used when BLOB_READ_WRITE_TOKEN is in the environment
 *    (Vercel sets it automatically on linked projects). PNGs go straight to
 *    the CDN; the returned URL is publicly accessible.
 *
 *  - Local disk: used during dev. Writes to a directory under cwd and serves
 *    files through the existing /api/exports/[file] proxy route.
 *
 * Callers don't care which backend wins — they just hand the buffer + a key
 * and get back a URL.
 */

export const EXPORTS_DIR = join(process.cwd(), ".readopp-exports");
export const EXPORTS_PUBLIC_PREFIX = "/api/exports";

function useBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function ensureLocalDir(): Promise<void> {
  if (!existsSync(EXPORTS_DIR)) await mkdir(EXPORTS_DIR, { recursive: true });
}

export interface StoredArtifact {
  /** Public URL the browser can fetch. */
  url: string;
  /** True if this artifact already existed and was reused (local backend only). */
  cached: boolean;
}

/**
 * Save a buffer to persistent storage under the given filename. The filename
 * is treated as a content-hash key — same filename = same artifact.
 *
 * Returns the public URL. For the local backend, also indicates whether the
 * artifact was already on disk so callers can skip work.
 */
export async function saveExportArtifact(input: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<StoredArtifact> {
  if (useBlob()) {
    const { put, head } = await import("@vercel/blob");
    // Try to short-circuit if a blob with this exact key already exists.
    try {
      const meta = await head(input.filename);
      if (meta?.url) return { url: meta.url, cached: true };
    } catch {
      // head() throws when the blob doesn't exist — fall through to put().
    }
    const { url } = await put(input.filename, input.buffer, {
      access: "public",
      contentType: input.contentType,
      addRandomSuffix: false,
      // Cache the asset on the CDN for a long time — keyed by content hash,
      // so a re-render with the same inputs hits the same URL.
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url, cached: false };
  }

  // Local disk fallback.
  await ensureLocalDir();
  const filePath = join(EXPORTS_DIR, input.filename);
  const url = `${EXPORTS_PUBLIC_PREFIX}/${input.filename}`;
  if (existsSync(filePath)) return { url, cached: true };
  await writeFile(filePath, input.buffer);
  return { url, cached: false };
}

/** Returns the on-disk file path for a local artifact, or null on the blob backend. */
export function localFilePathFor(filename: string): string | null {
  if (useBlob()) return null;
  return join(EXPORTS_DIR, filename);
}
