import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveExportArtifact } from "@/lib/export/storage";
import { getBrowser } from "@/lib/playwright";
import {
  RESUME_PAGE_TEMPLATES,
  renderResumePage,
  type ResumePageTemplateId,
} from "@/lib/render/resumePage";
import { getExplainer } from "@/lib/store";

/**
 * Render the single-page résumé *document* (Option B) to a print-ready PDF.
 * Only works for explainers that carry a structured `resumeDoc` (i.e. ones
 * built from a resume upload); everything else 400s. Output is a real
 * selectable-text PDF, so it stays ATS-parseable.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Chromium boot on a cold serverless function is ~3-5s; printing a single
// page is fast. Cap well under Vercel's 300s ceiling.
export const maxDuration = 120;

const TEMPLATE_IDS = RESUME_PAGE_TEMPLATES.map((t) => t.id) as [
  ResumePageTemplateId,
  ...ResumePageTemplateId[]
];

const RequestSchema = z.object({
  template: z.enum(TEMPLATE_IDS).default("classic"),
});

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex").slice(0, 16);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // An empty body is fine — default to the classic template.
    body = {};
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
    return NextResponse.json({ error: "Explainer not found." }, { status: 404 });
  }
  if (!explainer.resumeDoc) {
    return NextResponse.json(
      { error: "This explainer isn't a résumé, so there's no document to build." },
      { status: 400 }
    );
  }

  const { template } = parsed.data;
  const version = explainer.updatedAt ?? explainer.createdAt ?? "v0";
  const filename = `resume-${hashKey([explainer.id, template, version])}.pdf`;

  const html = renderResumePage(explainer.resumeDoc, template);

  const browser = await getBrowser();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let pdf: Buffer;
    try {
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => {});
      pdf = Buffer.from(
        await page.pdf({
          format: "Letter",
          printBackground: true,
          preferCSSPageSize: true,
        })
      );
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }

    const stored = await saveExportArtifact({
      buffer: pdf,
      filename,
      contentType: "application/pdf",
    });
    return NextResponse.json({
      url: stored.url,
      filename,
      template,
      cached: stored.cached,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[readopp] resume PDF export failed (explainer ${params.id}): ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return NextResponse.json(
      {
        error:
          "Couldn't build the résumé PDF. If this is the first run, Chromium may still be downloading.",
      },
      { status: 500 }
    );
  } finally {
    if (process.env.VERCEL) {
      await browser.close().catch(() => {});
      globalThis.__readopp_browser__ = undefined;
    }
  }
}
