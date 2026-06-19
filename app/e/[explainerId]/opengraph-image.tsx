import { ImageResponse } from "next/og";
import { sourceLabel } from "@/lib/shared/source";
import { getExplainer } from "@/lib/store";

/**
 * Dynamic Open Graph image for explainer permalinks.
 *
 * Renders a 1200×630 PNG with the explainer's title, source, panel
 * count, and Readopp wordmark on the brand's ivory paper background.
 * Picked up automatically by Next.js's `opengraph-image` file
 * convention — no manual metadata wiring needed; the route co-exists
 * with page.tsx so each permalink gets its own preview.
 *
 * Runs on nodejs so the supabase store call works (the same getExplainer
 * already used by the page component).
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

  // Fall back to a generic brand card when the explainer is missing /
  // private — better than 404'ing the OG endpoint, which would leave
  // the share preview blank.
  const title = explainer?.title ?? "Readopp";
  const source = explainer ? sourceLabel(explainer.url) : "readopp.app";
  const panelCount = explainer?.panels.length ?? 0;

  // Cap title length so the layout doesn't overflow on freakishly
  // long article titles. Satori's text wrap handles the rest.
  const displayTitle =
    title.length > 140 ? title.slice(0, 137).trimEnd() + "…" : title;

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
          padding: "72px 80px",
          // Subtle ambient glow in the top-right — same idea as the
          // .amb-tr utility on the site, but baked as a radial gradient
          // since Satori can't drive CSS classes.
          backgroundImage: `radial-gradient(60% 50% at 88% 0%, rgba(27,27,27,0.05), transparent 70%)`,
          color: INK,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Header — wordmark + tagline */}
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
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            Readopp
          </span>
          <span
            style={{
              marginLeft: 16,
              fontSize: 16,
              color: INK_MUTED,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Visual explainer
          </span>
        </div>

        {/* Title — display serif feel via large + tight tracking + Lilita
            fallback. Inter Bold at this size still reads as "publication"
            because of the scale. */}
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

        {/* Footer — source + panel count + accent rule */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${PAPER_LINE}`,
            paddingTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 22,
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
              fontSize: 18,
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
