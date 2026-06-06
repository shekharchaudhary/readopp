import { createHash } from "node:crypto";
import JSZip from "jszip";
import { saveExportArtifact } from "./storage";

/**
 * Bundle in-memory PNG buffers into a ZIP archive and persist via the
 * storage layer (disk locally, Vercel Blob in production). Idempotent —
 * same content hash returns the same URL.
 */
export interface ZipResult {
  url: string;
  filename: string;
  byteSize: number;
  cached: boolean;
}

export async function bundleAsZip(input: {
  /** PNG buffers, in the order they should appear in the zip. */
  buffers: Buffer[];
  /** Filenames (no path) inside the zip — same length as buffers. */
  entryNames: string[];
  /** Cache key — same value → same zip filename. */
  cacheKeyParts: string[];
  /** Base filename for the zip (no extension), used by the Save dialog. */
  baseName: string;
}): Promise<ZipResult> {
  if (input.buffers.length !== input.entryNames.length) {
    throw new Error("bundleAsZip: buffers and entryNames must be same length");
  }
  const hash = createHash("sha256")
    .update(input.cacheKeyParts.join("::"))
    .digest("hex")
    .slice(0, 16);
  const filename = `${input.baseName}-${hash}.zip`;

  const zip = new JSZip();
  for (let i = 0; i < input.buffers.length; i++) {
    zip.file(input.entryNames[i], input.buffers[i]);
  }
  const zipBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const stored = await saveExportArtifact({
    buffer: zipBuf,
    filename,
    contentType: "application/zip",
  });

  return {
    url: stored.url,
    filename,
    byteSize: zipBuf.length,
    cached: stored.cached,
  };
}
