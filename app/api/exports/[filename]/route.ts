import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { EXPORTS_DIR } from "@/lib/export/screenshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILENAME_OK = /^[a-z0-9._-]+\.png$/i;

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } }
) {
  const name = params.filename;
  if (!FILENAME_OK.test(name)) {
    return new NextResponse("bad filename", { status: 400 });
  }
  const filePath = join(EXPORTS_DIR, name);
  if (!filePath.startsWith(EXPORTS_DIR)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  if (!existsSync(filePath)) {
    return new NextResponse("not found", { status: 404 });
  }
  const buf = await readFile(filePath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
