import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAttributionExportHtml,
  buildPanelExportHtml,
  buildStackedExportHtml,
} from "@/lib/export/buildExportHtml";
import { createHash } from "node:crypto";
import { bundleAsZip } from "@/lib/export/bundleZip";
import { htmlToPng } from "@/lib/export/screenshot";
import { saveExportArtifact } from "@/lib/export/storage";
import { EXPORT_DIMENSIONS, isExportFormat } from "@/lib/export/dimensions";
import { getBrowser } from "@/lib/playwright";
import { getBrandKit, getExplainer } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";
import type { BrandKit, Explainer } from "@/lib/shared/schemas";

/** Cache-buster token — bumps whenever a panel or the brand is edited. */
function versionTag(e: Explainer, brand?: BrandKit | null): string {
  return [e.updatedAt ?? e.createdAt ?? "v0", brand?.updatedAt ?? "no-brand"].join(":");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Carousel renders + ZIP can run long when the explainer has many panels
// and the function is cold (Chromium boot ~3-5s on serverless). Vercel Pro
// allows up to 300s; we cap at 240s to leave headroom.
export const maxDuration = 240;

const RequestSchema = z.object({
  format: z.enum(["square", "vertical", "landscape"]),
  panelId: z.string().optional(), // section id, or omit for whole-explainer
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const explainer = await getExplainer(params.id);
  if (!explainer) {
    return NextResponse.json(
      { error: "Explainer not found." },
      { status: 404 }
    );
  }

  // Resolve the requesting user's brand kit so exports carry their color,
  // font, logo, and headline. Anonymous users get the default Readopp look.
  let brand: BrandKit | null = null;
  try {
    const { userId, isAnonymous } = await getOrCreateUser();
    if (!isAnonymous) {
      brand = await getBrandKit(userId);
    }
  } catch {
    // Brand lookup is best-effort; fall back to default styling.
  }

  const { format, panelId } = parsed.data;
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  // Single browser instance for the whole request. On Vercel the sandbox
  // can recycle Chromium between awaits (e.g. during a storage upload),
  // leaving the cached singleton pointing at a dead process. Owning the
  // lifetime here keeps it pinned until we're done rendering.
  const browser = await getBrowser();
  try {
    if (panelId) {
      const panelIndex = explainer.panels.findIndex(
        (p) => p.sectionId === panelId
      );
      if (panelIndex === -1) {
        return NextResponse.json(
          { error: "Panel not found in this explainer." },
          { status: 404 }
        );
      }
      const panel = explainer.panels[panelIndex];
      const html = await buildPanelExportHtml({
        explainer,
        panel,
        format,
        panelIndex: panelIndex + 1,
        totalPanels: explainer.panels.length,
        brand,
      });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, panelId, format, versionTag(explainer, brand)],
        browser,
      });
      return NextResponse.json({
        url: result.url,
        format: result.format,
        width: result.width,
        height: result.height,
        cached: result.cached,
      });
    }

    // Whole-explainer export.
    if (format === "vertical") {
      const html = await buildStackedExportHtml({ explainer, format, brand });
      const result = await htmlToPng({
        html,
        format,
        cacheKeyParts: [explainer.id, "all", format, versionTag(explainer, brand)],
        browser,
      });
      return NextResponse.json({
        url: result.url,
        format: result.format,
        width: result.width,
        height: result.height,
        cached: result.cached,
        kind: "stacked",
      });
    }

    // square/landscape: return one image per panel as a set, PLUS one
    // attribution slide at the end pointing back to the source.
    //
    // We render every panel through a single shared context + page on
    // Chromium. Cycling contexts between panels was crashing the browser
    // on Vercel — @sparticuz/chromium plus the sandbox's memory pressure
    // doesn't tolerate it. setContent inside one page is cheaper and
    // keeps the browser alive for the whole loop.
    const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
    const hashKey = (parts: string[]) =>
      createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
    const dims = EXPORT_DIMENSIONS[format];

    interface PanelRender {
      buffer: Buffer;
      filename: string;
    }
    const ctx = await browser.newContext({
      viewport: { width: dims.w, height: dims.h },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const renders: PanelRender[] = [];
    try {
      const renderOne = async (html: string, cacheKeyParts: string[]) => {
        await page.setContent(html, { waitUntil: "load" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const buffer = Buffer.from(
          await page.screenshot({
            type: "png",
            clip: { x: 0, y: 0, width: dims.w, height: dims.h },
          })
        );
        renders.push({
          buffer,
          filename: `${format}-${hashKey(cacheKeyParts)}.png`,
        });
      };

      for (let i = 0; i < explainer.panels.length; i++) {
        const panel = explainer.panels[i];
        const html = await buildPanelExportHtml({
          explainer,
          panel,
          format,
          panelIndex: i + 1,
          totalPanels: explainer.panels.length,
        });
        await renderOne(html, [
          explainer.id,
          panel.sectionId,
          format,
          versionTag(explainer, brand),
        ]);
      }

      const attrHtml = await buildAttributionExportHtml({
        explainer,
        format,
        brand,
      });
      await renderOne(attrHtml, [
        explainer.id,
        "__attribution__",
        format,
        versionTag(explainer, brand),
      ]);
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }

    // Browser work done — upload PNGs in parallel and stash buffers for the
    // ZIP step. Anything later in this handler is pure I/O.
    const stored = await Promise.all(
      renders.map((r) =>
        saveExportArtifact({
          buffer: r.buffer,
          filename: r.filename,
          contentType: "image/png",
        })
      )
    );

    const images: {
      url: string;
      width: number;
      height: number;
      sectionId: string;
      panelIndex: number;
      kind: "panel" | "attribution";
    }[] = explainer.panels.map((p, i) => ({
      url: stored[i].url,
      width: dims.w,
      height: dims.h,
      sectionId: p.sectionId,
      panelIndex: i + 1,
      kind: "panel",
    }));
    images.push({
      url: stored[stored.length - 1].url,
      width: dims.w,
      height: dims.h,
      sectionId: "__attribution__",
      panelIndex: explainer.panels.length + 1,
      kind: "attribution",
    });
    const buffers = renders.map((r) => r.buffer);
    const entryNames = [
      ...explainer.panels.map(
        (p, i) =>
          `${String(i + 1).padStart(2, "0")}-${slug(p.heading || p.sectionId)}.png`
      ),
      `${String(explainer.panels.length + 1).padStart(2, "0")}-source.png`,
    ];
    // Bundle everything into one zip the user can download in one click.
    const zip = await bundleAsZip({
      buffers,
      entryNames,
      cacheKeyParts: [explainer.id, format, versionTag(explainer, brand)],
      baseName: `readopp-${slug(explainer.title || explainer.id)}-${format}`,
    });
    return NextResponse.json({
      format,
      images,
      kind: "set",
      zipUrl: zip.url,
      zipName: zip.filename,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[readopp] export failed", e);
    return NextResponse.json(
      {
        error:
          "Export failed. If this is the first run, Chromium may still be downloading.",
      },
      { status: 500 }
    );
  } finally {
    // On Vercel we want to free the Chromium process now so the next
    // invocation gets a fresh one. Locally we keep the singleton alive.
    if (process.env.VERCEL) {
      await browser.close().catch(() => {});
      globalThis.__readopp_browser__ = undefined;
    }
  }
}
