import { ImageResponse } from "next/og";
import { sourceLabel } from "@/lib/shared/source";
import { getExplainer } from "@/lib/store";

/**
 * Dynamic Open Graph image for explainer permalinks.
 *
 * Renders a 1200×630 PNG: two-column layout with the explainer's title
 * + source on the left, the first panel rendered as a thumbnail on the
 * right (when the panel is SVG — Satori parses SVG well enough that we
 * can hand it the panel data URL directly). HTML panels and missing
 * explainers fall through to a title-only brand card.
 *
 * Picked up automatically by Next.js's `opengraph-image` file
 * convention — no manual metadata wiring needed; the route co-exists
 * with page.tsx so each permalink gets its own preview.
 *
 * Runs on nodejs so the supabase store call works (same getExplainer
 * the page component uses).
 */
export const runtime = "nodejs";
export const alt = "Readopp explainer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#FAF9F5";
const INK = "#1A1A1A";
const INK_SOFT = "#4E463C";
const INK_MUTED = "#7A6F62";
const PAPER_LINE = "#D6CFC2";
const CLAY = "#C7613D";

export default async function Image({
  params,
}: {
  params: { explainerId: string };
}) {
  const explainer = await getExplainer(params.explainerId);

  const title = explainer?.title ?? "Readopp";
  const source = explainer ? sourceLabel(explainer.url) : "readopp.app";
  const panelCount = explainer?.panels.length ?? 0;
  const firstPanel = explainer?.panels[0];
  const thumbnailDataUrl =
    firstPanel?.format === "svg" && firstPanel.content
      ? svgToDataUrl(firstPanel.content)
      : null;

  // Cap title length so the layout doesn't overflow on freakishly
  // long article titles. Satori's text wrap handles the rest.
  const displayTitle =
    title.length > 120 ? title.slice(0, 117).trimEnd() + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "56px 64px",
          // Subtle ambient glow in the top-right — same idea as the
          // .amb-tr utility on the site, baked as a radial gradient
          // because Satori can't drive CSS classes.
          backgroundImage: `radial-gradient(60% 50% at 88% 0%, rgba(27,27,27,0.05), transparent 70%)`,
          color: INK,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Header — wordmark + tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: INK,
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            Readopp
          </span>
          <span
            style={{
              marginLeft: 14,
              fontSize: 14,
              color: INK_MUTED,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Visual explainer
          </span>
        </div>

        {/* Middle — two-column when we have a thumbnail; full-width title
            block when we don't. */}
        {thumbnailDataUrl ? (
          <div
            style={{
              display: "flex",
              gap: 48,
              alignItems: "center",
              flex: 1,
              marginTop: 24,
              marginBottom: 24,
            }}
          >
            {/* Title column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                flex: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 600,
                  lineHeight: 1.08,
                  letterSpacing: "-0.022em",
                  color: INK,
                  display: "flex",
                }}
              >
                {displayTitle}
              </span>
            </div>
            {/* Thumbnail column */}
            <div
              style={{
                display: "flex",
                width: 440,
                height: 360,
                borderRadius: 12,
                border: `1px solid ${PAPER_LINE}`,
                background: "#FFFFFF",
                overflow: "hidden",
                boxShadow: "0 8px 32px -16px rgba(23,23,23,0.18)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailDataUrl}
                alt=""
                width={440}
                height={360}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              maxWidth: 1040,
            }}
          >
            <span
              style={{
                fontSize: 72,
                fontWeight: 600,
                lineHeight: 1.08,
                letterSpacing: "-0.022em",
                color: INK,
                display: "flex",
              }}
            >
              {displayTitle}
            </span>
          </div>
        )}

        {/* Footer — source + panel count + accent tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${PAPER_LINE}`,
            paddingTop: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 20,
              color: INK_SOFT,
            }}
          >
            <span>{source}</span>
            <span style={{ color: PAPER_LINE }}>·</span>
            <span>
              {panelCount} slide{panelCount === 1 ? "" : "s"}
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              color: CLAY,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Read · design · post
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

/**
 * Inline the panel SVG as a base64 data URL so Satori can rasterise it
 * inside the OG image. Satori's SVG renderer handles our templates'
 * text/rect/line/circle/ellipse/path cleanly; complex filters and
 * gradients would fall back to white, but none of the templates use them.
 */
function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
