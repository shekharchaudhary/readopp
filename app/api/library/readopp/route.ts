import { NextResponse } from "next/server";
import { buildReadoppLibrary } from "@/lib/editor/library";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Curated Readopp library served as a v2 .excalidrawlib document.
 *
 * EditorCanvas's "Add Readopp icons" button fetches this on demand and
 * pipes it into the user's library via excalidrawAPI.updateLibrary +
 * addFiles — the same pair Excalidraw uses internally when a user picks
 * "Browse libraries → Load from URL". Going through the supported import
 * path keeps us out of the v0.18 useHandleLibrary / atom-render edge
 * cases that refused to populate the Personal Library sidebar.
 */
export async function GET() {
  const { libraryItems } = buildReadoppLibrary();
  return NextResponse.json({
    type: "excalidrawlib",
    version: 2,
    source: "https://readopp.app",
    libraryItems,
  });
}
