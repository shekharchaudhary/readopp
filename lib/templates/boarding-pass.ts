import { EXPORT_DIMENSIONS } from "../export/dimensions";
import { sourceLabel } from "../shared/source";
import type {
  AttributionRenderInput,
  PanelRenderInput,
  TemplateDef,
} from "./types";

/**
 * Boarding Pass — every panel is an airline boarding pass. Two halves
 * separated by a dashed perforation: the main pass on the left with
 * passenger / FROM → TO / boarding time / gate, and a tear-off stub on
 * the right with seat + barcode.
 *
 * Why it works for a carousel: passes carry intrinsic narrative ("you
 * are going from idea-A to idea-B"). Each panel reads as a leg of a
 * journey, which is a useful frame for any "how I got here" or
 * "before/after" content.
 */

const PAPER = "#F4F1EA";
const SURFACE = "#FFFFFF";
const INK = "#1A1A1A";
const INK_SOFT = "#5A5048";
const INK_FAINT = "#A39A8C";
const NAVY = "#0033A0";
const ACCENT = "#0066CC";
const RULE = "#D7D2C5";

const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_MONO =
  "ui-monospace, 'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Sizes {
  outerPad: number;
  pad: number;
  topSize: number;
  airportSize: number;
  routeSize: number;
  hSize: number;
  metaSize: number;
  bodySize: number;
  stubLabelSize: number;
  gap: number;
  stubWidth: number;
}

function sizesFor(format: PanelRenderInput["format"]): Sizes {
  switch (format) {
    case "vertical":
      return {
        outerPad: 56,
        pad: 64,
        topSize: 24,
        airportSize: 130,
        routeSize: 32,
        hSize: 52,
        metaSize: 22,
        bodySize: 28,
        stubLabelSize: 20,
        gap: 26,
        stubWidth: 280,
      };
    case "landscape":
      return {
        outerPad: 28,
        pad: 32,
        topSize: 13,
        airportSize: 72,
        routeSize: 18,
        hSize: 28,
        metaSize: 12,
        bodySize: 16,
        stubLabelSize: 11,
        gap: 14,
        stubWidth: 200,
      };
    default: // square
      return {
        outerPad: 40,
        pad: 48,
        topSize: 18,
        airportSize: 100,
        routeSize: 22,
        hSize: 40,
        metaSize: 16,
        bodySize: 22,
        stubLabelSize: 14,
        gap: 20,
        stubWidth: 220,
      };
  }
}

function headingScaleFor(len: number): number {
  if (len <= 22) return 1.0;
  if (len <= 36) return 0.85;
  if (len <= 56) return 0.7;
  return 0.6;
}

/** Pick 3-letter "airport codes" deterministically so the pass feels
 *  like it has a real itinerary. Codes come from the first words of
 *  the explainer title and the panel heading; falls back to readable
 *  invented codes when we don't have enough text. */
function airportCode(text: string, fallbackSeed: string): string {
  const stop = new Set(["the", "a", "an", "of", "to", "in", "on", "and", "or"]);
  const words = (text || "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()));
  for (const w of words) {
    if (w.length >= 3) return w.slice(0, 3).toUpperCase();
  }
  // Deterministic fallback
  let n = 0;
  for (let i = 0; i < fallbackSeed.length; i++) n = (n * 31 + fallbackSeed.charCodeAt(i)) >>> 0;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return [0, 1, 2].map((i) => letters[(n >> (i * 5)) % 26]).join("");
}

function seatNumber(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return `${(n % 30) + 1}${"ABCDEF"[n % 6]}`;
}

function gateNumber(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 17 + seed.charCodeAt(i)) >>> 0;
  return `${"ABCD"[n % 4]}${(n % 24) + 1}`;
}

function flightNumber(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return `RP ${String((n % 9000) + 100)}`;
}

function timeStamp(panelIndex: number): string {
  const base = 7 * 60 + 30; // 07:30 base
  const minutes = base + panelIndex * 45;
  const h = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function isoDate(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getMonth()]}`;
}

function barcodeBars(seed: string, count = 36): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 17 + seed.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < count; i++) {
    n = (n * 1103515245 + 12345) >>> 0;
    out += `<span class="bar${(n & 1) === 1 ? " thin" : ""}"></span>`;
  }
  return out;
}

function baseCss(w: number, h: number, S: Sizes, headingScale = 1): string {
  return `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; font-family: ${FONT_SANS}; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .page {
    width: ${w}px;
    height: ${h}px;
    padding: ${S.outerPad}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse at 80% 110%, rgba(0,51,160,0.06), transparent 60%),
      ${PAPER};
    overflow: hidden;
  }
  .pass {
    width: 100%;
    height: 100%;
    background: ${SURFACE};
    border: 1px solid ${RULE};
    border-radius: 12px;
    box-shadow: 0 8px 32px -16px rgba(0,0,0,0.18);
    display: grid;
    grid-template-columns: 1fr ${S.stubWidth}px;
    overflow: hidden;
    position: relative;
  }
  .perf {
    position: absolute;
    top: 0; bottom: 0;
    right: ${S.stubWidth}px;
    width: 0;
    border-left: 2px dashed ${RULE};
  }
  .main {
    padding: ${S.pad}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-family: ${FONT_MONO};
    font-size: ${S.topSize}px;
    color: ${INK_SOFT};
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: ${S.gap}px;
  }
  .top .brand {
    color: ${NAVY};
    font-weight: 700;
    letter-spacing: 0.32em;
  }
  .route {
    display: grid;
    grid-template-columns: 1fr ${Math.round(S.routeSize * 6)}px 1fr;
    align-items: center;
    margin-bottom: ${S.gap}px;
  }
  .city { display: flex; flex-direction: column; gap: 4px; }
  .city.right { align-items: flex-end; text-align: right; }
  .city .code {
    font-family: ${FONT_SANS};
    font-size: ${S.airportSize}px;
    line-height: 1;
    font-weight: 800;
    color: ${INK};
    letter-spacing: -0.03em;
  }
  .city .label {
    font-family: ${FONT_MONO};
    font-size: ${S.metaSize}px;
    color: ${INK_FAINT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
  .arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${NAVY};
    font-size: ${S.routeSize}px;
  }
  .arrow .line {
    flex: 1;
    height: 2px;
    background: ${NAVY};
    margin: 0 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: ${Math.round(S.gap * 0.6)}px ${S.gap}px;
    border-top: 1px solid ${RULE};
    border-bottom: 1px solid ${RULE};
    padding: ${Math.round(S.gap * 0.6)}px 0;
    margin-bottom: ${S.gap}px;
    font-family: ${FONT_MONO};
  }
  .grid .label {
    font-size: ${S.metaSize}px;
    color: ${INK_FAINT};
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
  .grid .value {
    font-size: ${Math.round(S.metaSize * 1.5)}px;
    color: ${INK};
    font-weight: 700;
    letter-spacing: -0.005em;
  }
  .grid .value.accent { color: ${NAVY}; }
  .headline {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.hSize * headingScale)}px;
    line-height: 1.15;
    font-weight: 700;
    color: ${INK};
    letter-spacing: -0.01em;
    margin: 0 0 ${Math.round(S.gap * 0.5)}px;
    text-wrap: balance;
  }
  .body {
    font-family: ${FONT_SANS};
    font-size: ${S.bodySize}px;
    line-height: 1.45;
    color: ${INK_SOFT};
    margin: 0;
  }
  .stub {
    background: ${PAPER};
    padding: ${S.pad}px ${Math.round(S.pad * 0.7)}px;
    display: flex;
    flex-direction: column;
    gap: ${S.gap}px;
    overflow: hidden;
    border-left: 0;
  }
  .stub .label {
    font-family: ${FONT_MONO};
    font-size: ${S.stubLabelSize}px;
    color: ${INK_FAINT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }
  .stub .seat {
    font-family: ${FONT_SANS};
    font-size: ${Math.round(S.airportSize * 0.75)}px;
    color: ${NAVY};
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stub .meta {
    font-family: ${FONT_MONO};
    font-size: ${S.stubLabelSize}px;
    color: ${INK};
    letter-spacing: 0.06em;
  }
  .barcode {
    display: flex;
    align-items: end;
    gap: 1px;
    height: ${Math.round(S.pad)}px;
    margin-top: auto;
  }
  .barcode .bar { width: 4px; background: ${INK}; height: 100%; }
  .barcode .bar.thin { width: 2px; }
  `;
}

async function renderPanel(input: PanelRenderInput): Promise<string> {
  const { explainer, panel, format, panelIndex, totalPanels } = input;
  const dims = EXPORT_DIMENSIONS[format];
  const S = sizesFor(format);
  const heading = panel.heading?.trim() || explainer.title;
  const body = panel.caption?.trim();
  const headingScale = headingScaleFor(heading.length);
  const from = airportCode(
    explainer.title || "",
    `${explainer.id}-from-${panelIndex}`
  );
  const to = airportCode(
    panel.heading || sourceLabel(explainer.url),
    `${explainer.id}-to-${panelIndex}`
  );
  const flight = flightNumber(`${explainer.id}-${panelIndex}`);
  const seat = seatNumber(`${explainer.id}-${panelIndex}`);
  const gate = gateNumber(`${explainer.id}-${panelIndex}`);
  const boardTime = timeStamp(panelIndex - 1);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, headingScale)}</style>
</head>
<body>
  <main class="page">
    <div class="pass">
      <div class="perf"></div>
      <section class="main">
        <header class="top">
          <span class="brand">Readopp Air</span>
          <span>${flight} · panel ${String(panelIndex).padStart(2, "0")}/${String(totalPanels).padStart(2, "0")}</span>
        </header>
        <div class="route">
          <div class="city">
            <div class="code">${escapeHtml(from)}</div>
            <div class="label">From</div>
          </div>
          <div class="arrow"><span class="line"></span>✈<span class="line"></span></div>
          <div class="city right">
            <div class="code">${escapeHtml(to)}</div>
            <div class="label">To</div>
          </div>
        </div>
        <div class="grid">
          <div><div class="label">Date</div><div class="value">${isoDate()}</div></div>
          <div><div class="label">Boarding</div><div class="value">${boardTime}</div></div>
          <div><div class="label">Gate</div><div class="value accent">${gate}</div></div>
          <div><div class="label">Class</div><div class="value">FOCUS</div></div>
        </div>
        <h1 class="headline">${escapeHtml(heading)}</h1>
        ${body ? `<p class="body">${escapeHtml(body)}</p>` : ""}
      </section>
      <aside class="stub">
        <div>
          <div class="label">Seat</div>
          <div class="seat">${seat}</div>
        </div>
        <div>
          <div class="label">Flight</div>
          <div class="meta">${flight}</div>
        </div>
        <div>
          <div class="label">Passenger</div>
          <div class="meta">READER / ONE</div>
        </div>
        <div class="barcode">${barcodeBars(`${explainer.id}-${panelIndex}`)}</div>
      </aside>
    </div>
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
  const from = airportCode(explainer.title || "", `${explainer.id}-from-src`);
  const to = "SRC";
  const flight = flightNumber(`${explainer.id}-src`);
  const seat = "1A";
  const gate = gateNumber(`${explainer.id}-src`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${baseCss(dims.w, dims.h, S, 0.85)}
  .src-url {
    font-family: ${FONT_MONO};
    font-size: ${Math.round(S.bodySize * 0.8)}px;
    color: ${NAVY};
    border: 1px dashed ${NAVY};
    padding: ${Math.round(S.gap * 0.5)}px;
    border-radius: 6px;
    word-break: break-all;
    margin-top: ${S.gap}px;
  }
</style>
</head>
<body>
  <main class="page">
    <div class="pass">
      <div class="perf"></div>
      <section class="main">
        <header class="top">
          <span class="brand">Readopp Air</span>
          <span>${flight} · source</span>
        </header>
        <div class="route">
          <div class="city">
            <div class="code">${escapeHtml(from)}</div>
            <div class="label">From</div>
          </div>
          <div class="arrow"><span class="line"></span>✈<span class="line"></span></div>
          <div class="city right">
            <div class="code">${to}</div>
            <div class="label">Source</div>
          </div>
        </div>
        <div class="grid">
          <div><div class="label">Date</div><div class="value">${isoDate()}</div></div>
          <div><div class="label">Boarding</div><div class="value">NOW</div></div>
          <div><div class="label">Gate</div><div class="value accent">${gate}</div></div>
          <div><div class="label">Class</div><div class="value">ORIGIN</div></div>
        </div>
        <h1 class="headline">${escapeHtml(explainer.title)}</h1>
        <div class="src-url">${escapeHtml(explainer.url)}</div>
      </section>
      <aside class="stub">
        <div>
          <div class="label">Seat</div>
          <div class="seat">${seat}</div>
        </div>
        <div>
          <div class="label">Flight</div>
          <div class="meta">${flight}</div>
        </div>
        <div>
          <div class="label">From</div>
          <div class="meta">${escapeHtml(sourceLabel(explainer.url))}</div>
        </div>
        <div class="barcode">${barcodeBars(`${explainer.id}-src`)}</div>
      </aside>
    </div>
  </main>
</body>
</html>`;
}

export const boardingPassTemplate: TemplateDef = {
  id: "boarding-pass",
  name: "Boarding Pass",
  category: "Document",
  tagline: "Airline boarding pass with gate, seat, and a perforated tear-off stub.",
  audience: "Travel writers, founders telling journeys, narrative essayists.",
  preview: {
    background: PAPER,
    foreground: INK,
    accent: NAVY,
    sampleHeading: "Gate 04 · Seat 12A",
    fontFamily: FONT_SANS,
  },
  renderPanel,
  renderAttribution,
};
