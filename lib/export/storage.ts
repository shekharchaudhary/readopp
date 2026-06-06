import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAdminSupabase } from "../supabase/server";

/**
 * Storage abstraction for export artifacts (PNGs, ZIPs). Two backends:
 *
 *  - Supabase Storage: used in production (when VERCEL is set). PNGs/ZIPs
 *    go into a public bucket; the returned URL is CDN-backed and public.
 *
 *  - Local disk: used during dev. Writes to a directory under cwd and serves
 *    files through the existing /api/exports/[file] proxy route.
 *
 * Callers don't care which backend wins — they just hand the buffer + a key
 * and get back a URL.
 */

export const EXPORTS_DIR = join(process.cwd(), ".readopp-exports");
export const EXPORTS_PUBLIC_PREFIX = "/api/exports";
const SUPABASE_BUCKET = "readopp-exports";

function useSupabase(): boolean {
  return Boolean(process.env.VERCEL);
}

async function ensureLocalDir(): Promise<void> {
  if (!existsSync(EXPORTS_DIR)) await mkdir(EXPORTS_DIR, { recursive: true });
}

export interface StoredArtifact {
  url: string;
  cached: boolean;
}

export async function saveExportArtifact(input: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<StoredArtifact> {
  if (useSupabase()) {
    const admin = getAdminSupabase();
    const { error } = await admin.storage
      .from(SUPABASE_BUCKET)
      .upload(input.filename, input.buffer, {
        contentType: input.contentType,
        upsert: false,
        cacheControl: "31536000",
      });
    const publicUrl = admin.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(input.filename).data.publicUrl;
    if (!error) return { url: publicUrl, cached: false };
    // Object already exists → same content hash, treat as cache hit.
    if (
      error.message?.toLowerCase().includes("already exists") ||
      error.message?.toLowerCase().includes("duplicate")
    ) {
      return { url: publicUrl, cached: true };
    }
    throw error;
  }

  await ensureLocalDir();
  const filePath = join(EXPORTS_DIR, input.filename);
  const url = `${EXPORTS_PUBLIC_PREFIX}/${input.filename}`;
  if (existsSync(filePath)) return { url, cached: true };
  await writeFile(filePath, input.buffer);
  return { url, cached: false };
}

/** Returns the on-disk file path for a local artifact, or null on the cloud backend. */
export function localFilePathFor(filename: string): string | null {
  if (useSupabase()) return null;
  return join(EXPORTS_DIR, filename);
}

/**
 * Look up an already-stored artifact by filename. Returns its public URL or
 * null if not present. Lets callers skip expensive renders on cache hits.
 */
export async function findExportArtifact(
  filename: string
): Promise<string | null> {
  if (useSupabase()) {
    const admin = getAdminSupabase();
    // List with an exact-name search; bucket listing is the cheapest hit.
    const { data, error } = await admin.storage
      .from(SUPABASE_BUCKET)
      .list("", { search: filename, limit: 1 });
    if (error || !data) return null;
    const found = data.find((o) => o.name === filename);
    if (!found) return null;
    return admin.storage.from(SUPABASE_BUCKET).getPublicUrl(filename).data
      .publicUrl;
  }
  const filePath = join(EXPORTS_DIR, filename);
  if (!existsSync(filePath)) return null;
  return `${EXPORTS_PUBLIC_PREFIX}/${filename}`;
}
