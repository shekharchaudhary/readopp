import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Galaxy Brain — the LinkedIn expanding-brain meme, tastefully cosmic.
 * Each panel is a tier of enlightenment: the brain (🧠) glows brighter
 * and the background drifts from twilight to supernova as the carousel
 * progresses. The whole point is to give a hot-take thread a wink of
 * meme-literate self-awareness without leaning on copyrighted images.
 *
 * The brain emoji renders through Chromium's bundled emoji font, so
 * the look is consistent across our headless screenshot pipeline and
 * an in-page iframe preview.
 */

interface Tier {
  id: string;
  label: string;
  panelBg: string;
  brainHalo: string;
  haloRadius: number;
  accent: string;
  sparkleCount: number;
}

const TIERS: Tier[] = [
  {
    id: "earthbound",
    label: "Earthbound",
    panelBg:
      "radial-gradient(120% 90% at 50% 50%, #2C2F4E 0%, #14162B 65%, #0B0C1B 100%)",
    brainHalo: "rgba(155,165,199,0.35)",
    haloRadius: 14,
    accent: "#9BA5C7",
    sparkleCount: 0,
  },
  {
    id: "illuminated",
    label: "Illuminated",
    panelBg:
      "radial-gradient(120% 90% at 50% 50%, #3D4280 0%, #14163A 65%, #0B0C1B 100%)",
    brainHalo: "rgba(124,140,255,0.55)",
    haloRadius: 28,
    accent: "#7C8CFF",
    sparkleCount: 4,
  },
  {
    id: "transcendent",
    label: "Transcendent",
    panelBg:
      "radial-gradient(120% 90% at 50% 50%, #6047C8 0%, #1A1438 60%, #0B0820 100%)",
    brainHalo: "rgba(200,179,255,0.7)",
    haloRadius: 44,
    accent: "#C8B3FF",
    sparkleCount: 8,
  },
  {
    id: "cosmic",
    label: "Cosmic",
    panelBg:
      "radial-gradient(120% 90% at 50% 50%, #C459FF 0%, #1A0838 60%, #050020 100%)",
    brainHalo: "rgba(255,210,255,0.8)",
    haloRadius: 60,
    accent: "#FFD2FF",
    sparkleCount: 14,
  },
  {
    id: "supernova",
    label: "Supernova",
    panelBg:
      "radial-gradient(120% 90% at 50% 50%, #FF6BB5 0%, #2A0838 55%, #050020 100%)",
    brainHalo: "rgba(255,255,255,0.95)",
    haloRadius: 90,
    accent: "#FF6BB5",
    sparkleCount: 22,
  },
];

const FONT_DISPLAY =
  "'Söhne', 'Inter', ui-sans-serif, -apple-system, system-ui, 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO =
  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tierFor(panelIndex: number, totalPanels: number): Tier {
  // Distribute panels across tiers — first is Earthbound, last is Supernova.
  // With <5 panels we still hit the extremes.
  if (totalPanels <= 1) return TIERS[TIERS.length - 1];
  const t = Math.round(
    ((panelIndex - 1) / (totalPanels - 1)) * (TIERS.length - 1)
  );
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, t))];
}

// Deterministic-ish sparkle positions in a 0..1 unit square, so the
// preview iframe and the headless export render identically.
const SPARKLE_SEEDS = [
  [0.08, 0.18],
  [0.14, 0.52],
  [0.22, 0.78],
  [0.36, 0.12],
  [0.41, 0.86],
  [0.55, 0.06],
  [0.62, 0.74],
  [0.71, 0.32],
  [0.78, 0.62],
  [0.84, 0.16],
  [0.9, 0.48],
  [0.95, 0.82],
  [0.05, 0.74],
  [0.17, 0.34],
  [0.27, 0.58],
  [0.32, 0.92],
  [0.48, 0.4],
  [0.5, 0.92],
  [0.66, 0.18],
  [0.74, 0.88],
  [0.87, 0.34],
  [0.93, 0.66],
];

function sparklesSvg(w: number, h: number, count: number, color: string): string {
  if (count === 0) return "";
  const points = SPARKLE_SEEDS.slice(0, Math.min(count, SPARKLE_SEEDS.length));
  const items = points
    .map(([px, py], i) => {
      const cx = Math.round(px * w);
      const cy = Math.round(py * h);
      const size = 4 + (i % 4) * 2;
      // 4-point sparkle (vertical + horizontal lines) + a soft center dot
      return `
        <g opacity="${0.6 + (i % 3) * 0.13}">
          <circle cx="${cx}" cy="${cy}" r="${size * 0.5}" fill="${color}" />
          <line x1="${cx}" y1="${cy - size * 2}" x2="${cx}" y2="${cy + size * 2}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
          <line x1="${cx - size * 2}" y1="${cy}" x2="${cx + size * 2}" y2="${cy}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
        </g>
      `;
    })
    .join("");
  return `<svg class="sparkles" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${items}</svg>`;
}

interface Sizes {
  pad: number;
  topSize: number;
  hSize: number;
  bodySize: number;
  footerSize: number;
  brainSize: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        pad: 72,
        topSize: 22,
        hSize: 78,
        bodySize: 30,
        footerSize: 18,
        brainSize: 520,
      };
    case "landscape":
      return {
        pad: 32,
        topSize: 12,
        hSize: 36,
        bodySize: 16,
        footerSize: 11,
        brainSize: 200,
      };
    default: // square
      return {
        pad: 60,
        topSize: 18,
        hSize: 62,
        bodySize: 24,
        footerSize: 14,
        brainSize: 380,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 14) return 1.15;
  if (len <= 24) return 1.0;
  if (len <= 40) return 0.82;
  if (len <= 60) return 0.66;
  return 0.55;
}

function baseCss(
  w: number,
  h: number,
  S: Sizes,
  tier: Tier,
  headingScale: number
): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0B0C1B; color: white; font-family: ${FONT_DISPLAY}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.pad}px;
    background: ${tier.panelBg};
    color: white;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .sparkles {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .top {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    font-family: ${FONT_MONO};
    font-size: ${S.topSize}px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: ${tier.accent};
    z-index: 3;
  }
  .tier-badge {
    display: inline-flex;
    align-items: baseline;
    gap: 14px;
  }
  .tier-label {
    color: white;
    font-weight: 700;
    letter-spacing: 0.18em;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }
  .brain {
    font-size: ${S.brainSize}px;
    line-height: 1;
    /* Multiple drop-shadows stack a soft cosmic halo around the emoji. */
    filter:
      drop-shadow(0 0 ${Math.round(tier.haloRadius * 0.5)}px ${tier.brainHalo})
      drop-shadow(0 0 ${tier.haloRadius}px ${tier.brainHalo})
      drop-shadow(0 0 ${Math.round(tier.haloRadius * 1.7)}px ${tier.brainHalo});
    animation: none;
  }
  .headline {
    position: relative;
    z-index: 3;
    font-family: ${FONT_DISPLAY};
    font-weight: 800;
    color: white;
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.05;
    margin: 0;
    letter-spacing: -0.02em;
    text-align: center;
    text-shadow: 0 2px 24px ${tier.brainHalo};
  }
  .body {
    position: relative;
    z-index: 3;
    margin: ${Math.round(S.pad * 0.4)}px auto 0;
    max-width: 80%;
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    color: rgba(255,255,255,0.85);
    text-align: center;
  }
  .footer {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: ${FONT_MONO};
    font-size: ${S.footerSize}px;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    margin-top: ${Math.round(S.pad * 0.4)}px;
  }
  .gauge {
    display: inline-flex;
    gap: ${Math.max(3, Math.round(S.footerSize * 0.35))}px;
    align-items: center;
  }
  .gauge .bar {
    width: ${Math.round(S.footerSize * 1.4)}px;
    height: ${Math.round(S.footerSize * 0.7)}px;
    background: rgba(255,255,255,0.12);
    border-radius: 1px;
  }
  .gauge .bar.lit {
    background: ${tier.accent};
    box-shadow: 0 0 ${Math.round(S.footerSize * 0.8)}px ${tier.brainHalo};
  }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const tier = tierFor(panelIndex, totalPanels);
  const tierIndex = TIERS.indexOf(tier);
  const headline = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const headingScale = headingScaleFor(headline.length);
  const sparklesHtml = sparklesSvg(dims.w, dims.h, tier.sparkleCount, tier.accent);

  // Brain power gauge: tierIndex+1 lit out of TIERS.length
  const gaugeBars = TIERS.map(
    (_, i) => `<span class="bar ${i <= tierIndex ? "lit" : ""}"></span>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, tier, headingScale)}</style>
</head>
<body>
  <main class="page">
    ${sparklesHtml}
    <header class="top">
      <span class="tier-badge">
        <span>Tier ${String(tierIndex + 1).padStart(2, "0")}</span>
        <span class="tier-label">${tier.label}</span>
      </span>
      <span>${escapeHtml(sourceLabel(explainer.url).toUpperCase())} · ${String(panelIndex).padStart(2, "0")}/${String(totalPanels).padStart(2, "0")}</span>
    </header>
    <section class="stage">
      <div class="brain" aria-hidden="true">🧠</div>
    </section>
    <h1 class="headline">${escapeHtml(headline)}</h1>
    ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
    <footer class="footer">
      <span>Brain power</span>
      <span class="gauge">${gaugeBars}</span>
      <span>readopp.com</span>
    </footer>
  </main>
</body>
</html>`;
}

async function renderAttribution(
  input: AttributionRenderInput
): Promise<string> {
  const { explainer, format } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const tier = TIERS[TIERS.length - 1]; // Supernova for the closer
  const headline = "Now go read it yourself.";
  const headingScale = headingScaleFor(headline.length);
  const sparklesHtml = sparklesSvg(dims.w, dims.h, tier.sparkleCount, tier.accent);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, tier, headingScale)}
  .src-url {
    display: inline-block;
    margin-top: ${Math.round(S.pad * 0.3)}px;
    padding: ${Math.round(S.bodySize * 0.5)}px ${Math.round(S.bodySize * 0.9)}px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 999px;
    color: white;
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.bodySize * 0.78)}px;
    word-break: break-all;
    max-width: 90%;
  }
</style>
</head>
<body>
  <main class="page">
    ${sparklesHtml}
    <header class="top">
      <span class="tier-badge">
        <span>Tier ∞</span>
        <span class="tier-label">${tier.label}</span>
      </span>
      <span>READOPP · END</span>
    </header>
    <section class="stage">
      <div class="brain" aria-hidden="true">🧠</div>
    </section>
    <h1 class="headline">${escapeHtml(headline)}</h1>
    <p class="body">
      ${escapeHtml(explainer.title)}
      <br />
      <span class="src-url">${escapeHtml(explainer.url)}</span>
    </p>
    <footer class="footer">
      <span>Brain power</span>
      <span class="gauge">${TIERS.map(() => '<span class="bar lit"></span>').join("")}</span>
      <span>readopp.com</span>
    </footer>
  </main>
</body>
</html>`;
}

export const galaxyBrainTemplate: TemplateDef = {
  id: "galaxy-brain",
  name: "Galaxy Brain",
  category: "Bold",
  tagline: "Expanding-brain meme energy, tastefully cosmic.",
  audience:
    "Hot-take threads and self-aware essayists who've earned a wink from their feed.",
  preview: {
    background: "#1A0838",
    foreground: "#FFFFFF",
    accent: "#FFD2FF",
    sampleHeading: "Reading the source paper.",
    fontFamily: FONT_DISPLAY,
  },
  renderPanel,
  renderAttribution,
};
