import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { EXPORTS_DIR, EXPORTS_PUBLIC_PREFIX } from "./screenshot";

/**
 * Bundle a list of PNG files into a single ZIP for one-click download.
 * Files are read from disk (they were just produced by htmlToPng), zipped
 * in memory, and cached on disk under a hash of their paths so identical
 * exports return instantly on subsequent calls.
 */
export interface ZipResult {
  url: string;
  filePath: string;
  filename: string;
  byteSize: number;
  cached: boolean;
}

export async function bundleAsZip(input: {
  /** Absolute paths to the source PNGs. Order is preserved. */
  filePaths: string[];
  /** Filenames (without path) to use inside the zip — same order as filePaths. */
  entryNames: string[];
  /** Cache key — same value → same zip filename on disk. */
  cacheKeyParts: string[];
  /** Filename for the zip (no extension), used by the browser's Save dialog. */
  baseName: string;
}): Promise<ZipResult> {
  if (input.filePaths.length !== input.entryNames.length) {
    throw new Error("bundleAsZip: filePaths and entryNames must be same length");
  }
  const hash = createHash("sha256")
    .update(input.cacheKeyParts.join("::"))
    .digest("hex")
    .slice(0, 16);
  const filename = `${input.baseName}-${hash}.zip`;
  const filePath = join(EXPORTS_DIR, filename);
  const url = `${EXPORTS_PUBLIC_PREFIX}/${filename}`;

  if (existsSync(filePath)) {
    const buf = await readFile(filePath);
    return {
      url,
      filePath,
      filename,
      byteSize: buf.length,
      cached: true,
    };
  }

  const zip = new JSZip();
  for (let i = 0; i < input.filePaths.length; i++) {
    const data = await readFile(input.filePaths[i]);
    zip.file(input.entryNames[i], data);
  }
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await writeFile(filePath, buf);
  return {
    url,
    filePath,
    filename,
    byteSize: buf.length,
    cached: false,
  };
}
