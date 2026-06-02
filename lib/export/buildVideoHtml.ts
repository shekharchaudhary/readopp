import QRCode from "qrcode";
import type { Explainer, RenderedPanel } from "../shared/schemas";
import { sourceLabel } from "../shared/source";

const ACCENT = "#1F97DC";
const PAPER = "#fafaf7";
const INK = "#1a1a1a";
const INK_SOFT = "#3a3a3a";
const INK_MUTED = "#6b6b6b";
const INK_FAINT = "#a3a3a3";
const PAPER_LINE = "#e3e1d8";

/** Per-format dimensions and typography for video output. */
export type VideoFormat = "vertical" | "square";

export const VIDEO_DIMENSIONS: Record<
  VideoFormat,
  { w: number; h: number; label: string }
> = {
  vertical: { w: 1080, h: 1920, label: "TikTok / Reels / Shorts" },
  square: { w: 1080, h: 1080, label: "Instagram feed" },
};

export function isVideoFormat(s: string): s is VideoFormat {
  return s === "vertical" || s === "square";
}

// Max panels in a video. More than this becomes too long for short-form feeds.
const MAX_PANELS = 6;

// Timing — all milliseconds.
const INTRO_MS = 2400;
const SCENE_MS = 4200; // per-panel scene
const CROSSFADE_MS = 500; // overlap between scenes
const OUTRO_MS = 3200;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function qrSvg(target: string, size: number): Promise<string> {
  return QRCode.toString(target, {
    type: "svg",
    margin: 0,
    width: size,
    color: { dark: INK, light: "#00000000" },
    errorCorrectionLevel: "M",
  });
}

interface Layout {
  padding: number;
  heroSize: number;
  headingSize: number;
  captionSize: number;
  brandSize: number;
  metaSize: number;
  qrSize: number;
  panelMaxH: number;
}

function layoutFor(format: VideoFormat): Layout {
  switch (format) {
    case "vertical":
      return {
        padding: 80,
        heroSize: 80,
        headingSize: 60,
        captionSize: 32,
        brandSize: 34,
        metaSize: 24,
        qrSize: 180,
        panelMaxH: 1000,
      };
    case "square":
      return {
        padding: 64,
        heroSize: 54,
        headingSize: 44,
        captionSize: 24,
        brandSize: 26,
        metaSize: 18,
        qrSize: 140,
        panelMaxH: 620,
      };
  }
}

interface VideoBuild {
  html: string;
  durationMs: number;
  panelsShown: number;
}

interface BuildInput {
  explainer: Explainer;
  format: VideoFormat;
}

/**
 * Build a single self-contained HTML doc that auto-plays as a timed slideshow.
 * Scenes are absolutely positioned so they cross-fade in place. Animations
 * start paused; a tiny inline script flips `body.go` once everything is
 * settled — Playwright waits for that signal before timing the recording.
 */
export async function buildVideoHtml(input: BuildInput): Promise<VideoBuild> {
  const { explainer, format } = input;
  const dims = VIDEO_DIMENSIONS[format];
  const L = layoutFor(format);
  const panels = explainer.panels.slice(0, MAX_PANELS);
  const totalPanels = explainer.panels.length;
  const shown = panels.length;
  const domain = sourceLabel(explainer.url);
  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize);

  // Scene timing: each scene starts staggered by (SCENE_MS - CROSSFADE_MS).
  const stepMs = SCENE_MS - CROSSFADE_MS;
  const introStart = 0;
  const firstSceneStart = INTRO_MS - CROSSFADE_MS;
  const outroStart = firstSceneStart + shown * stepMs;
  const totalMs = outroStart + OUTRO_MS;

  const sceneHtml = panels
    .map((p, i) => renderScene(p, i, shown, totalPanels, L, firstSceneStart, stepMs))
    .join("\n");

  return {
    durationMs: totalMs,
    panelsShown: shown,
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK};
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body { width: ${dims.w}px; height: ${dims.h}px; overflow: hidden; }

  .stage {
    position: relative;
    width: ${dims.w}px;
    height: ${dims.h}px;
    background: ${PAPER};
  }

  .scene {
    position: absolute;
    inset: 0;
    padding: ${L.padding}px;
    display: flex;
    flex-direction: column;
    opacity: 0;
    animation-fill-mode: forwards;
    animation-play-state: paused;
  }
  body.go .scene { animation-play-state: running; }

  @keyframes scene-show {
    0%   { opacity: 0; transform: translateY(8px); }
    8%   { opacity: 1; transform: translateY(0); }
    92%  { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-8px); }
  }
  @keyframes scene-show-hold {
    0%   { opacity: 0; transform: translateY(8px); }
    10%  { opacity: 1; transform: translateY(0); }
    100% { opacity: 1; transform: translateY(0); }
  }

  /* Persistent footer wordmark across all scenes */
  .corner-mark {
    position: absolute;
    left: ${L.padding}px;
    bottom: ${Math.round(L.padding * 0.6)}px;
    display: inline-flex; align-items: center; gap: 10px;
    font-size: ${L.metaSize}px; color: ${INK_MUTED}; font-weight: 500;
    z-index: 5;
    opacity: 0;
    animation: fade-in 600ms ease 800ms forwards;
    animation-play-state: paused;
  }
  body.go .corner-mark { animation-play-state: running; }
  .corner-mark .dot { width: 10px; height: 10px; border-radius: 999px; background: ${ACCENT}; }
  .corner-mark .name { color: ${INK}; font-weight: 600; letter-spacing: -0.01em; }
  .corner-mark .sep { color: ${INK_FAINT}; }

  @keyframes fade-in {
    from { opacity: 0; } to { opacity: 1; }
  }

  /* -------- Intro scene -------- */
  .scene-intro { justify-content: center; }
  .intro-eyebrow {
    font-size: ${L.metaSize}px; color: ${ACCENT}; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 18px;
    opacity: 0; animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 100ms forwards;
    animation-play-state: paused;
  }
  body.go .intro-eyebrow { animation-play-state: running; }
  .intro-title {
    font-size: ${L.heroSize}px; line-height: 1.05; font-weight: 600;
    color: ${INK}; letter-spacing: -0.02em; max-width: 100%;
    opacity: 0; animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 300ms forwards;
    animation-play-state: paused;
  }
  body.go .intro-title { animation-play-state: running; }
  .intro-summary {
    font-size: ${L.captionSize}px; line-height: 1.4; color: ${INK_SOFT};
    margin-top: 26px; max-width: 92%;
    opacity: 0; animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 600ms forwards;
    animation-play-state: paused;
  }
  body.go .intro-summary { animation-play-state: running; }
  .intro-source {
    margin-top: 32px; display: inline-flex; align-items: center; gap: 10px;
    font-size: ${L.metaSize}px; color: ${INK_MUTED};
    opacity: 0; animation: fade-in 600ms ease 1100ms forwards;
    animation-play-state: paused;
  }
  body.go .intro-source { animation-play-state: running; }
  .intro-source .pip { width: 6px; height: 6px; border-radius: 999px; background: ${ACCENT}; }

  /* -------- Panel scene -------- */
  .scene-panel { justify-content: flex-start; }
  .panel-header {
    display: flex; align-items: baseline; gap: 14px;
    margin-bottom: 28px;
  }
  .panel-num {
    font-variant-numeric: tabular-nums;
    font-size: ${L.metaSize}px; color: ${ACCENT}; font-weight: 600;
    letter-spacing: 0.04em;
  }
  .panel-num::before {
    content: ""; display: inline-block; width: 24px; height: 1px;
    background: ${ACCENT}; vertical-align: middle; margin-right: 10px;
    transform-origin: left;
    transform: scaleX(0);
    animation: rule-grow 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-play-state: paused;
  }
  body.go .panel-num::before { animation-play-state: running; }
  @keyframes rule-grow { to { transform: scaleX(1); } }

  .panel-heading {
    font-size: ${L.headingSize}px; line-height: 1.08; font-weight: 600;
    color: ${INK}; letter-spacing: -0.018em;
    opacity: 0; transform: translateY(10px);
    animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 180ms forwards;
    animation-play-state: paused;
  }
  body.go .panel-heading { animation-play-state: running; }

  .panel-visual {
    margin-top: 32px;
    display: flex; align-items: center; justify-content: center;
    flex: 1; min-height: 0;
  }
  .panel-visual > * { max-width: 100%; max-height: ${L.panelMaxH}px; }
  .panel-visual svg { width: 100%; height: auto; max-height: ${L.panelMaxH}px; }
  .panel-visual .html-panel { background: #ffffff; border: 1px solid ${PAPER_LINE};
    border-radius: 14px; padding: 22px; width: 100%; }
  .panel-visual .html-panel table { border-collapse: collapse; width: 100%; }
  .panel-visual .html-panel td, .panel-visual .html-panel th {
    padding: 10px 12px; font-size: 16px; vertical-align: top; border-bottom: 1px solid ${PAPER_LINE};
  }
  .panel-visual .html-panel th { font-weight: 500; background: #F1EFE8; text-align: left; }

  /* Stagger draw-in for SVG children once the scene shows. */
  .panel-visual svg > * {
    opacity: 0;
    animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-play-state: paused;
  }
  body.go .panel-visual svg > * { animation-play-state: running; }

  .panel-caption {
    margin-top: 28px;
    font-size: ${L.captionSize}px; line-height: 1.4; color: ${INK_SOFT};
    opacity: 0; transform: translateY(8px);
    animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 1200ms forwards;
    animation-play-state: paused;
  }
  body.go .panel-caption { animation-play-state: running; }

  @keyframes rise {
    to { opacity: 1; transform: translateY(0); }
  }

  /* -------- Outro scene -------- */
  .scene-outro { justify-content: center; align-items: center; text-align: center; }
  .outro-block { display: flex; flex-direction: column; align-items: center; gap: 28px; }
  .outro-eyebrow {
    font-size: ${L.metaSize}px; color: ${ACCENT}; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    opacity: 0; animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 100ms forwards;
    animation-play-state: paused;
  }
  body.go .outro-eyebrow { animation-play-state: running; }
  .outro-title {
    font-size: ${Math.round(L.heroSize * 0.82)}px; line-height: 1.1; font-weight: 600;
    color: ${INK}; letter-spacing: -0.02em; max-width: 90%;
    opacity: 0; animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) 250ms forwards;
    animation-play-state: paused;
  }
  body.go .outro-title { animation-play-state: running; }
  .outro-qr {
    margin-top: 12px; padding: 24px; background: #ffffff;
    border: 1px solid ${PAPER_LINE}; border-radius: 18px; line-height: 0;
    opacity: 0; transform: scale(0.96);
    animation: pop 700ms cubic-bezier(0.22, 1, 0.36, 1) 500ms forwards;
    animation-play-state: paused;
  }
  body.go .outro-qr { animation-play-state: running; }
  .outro-qr svg { display: block; width: ${L.qrSize}px; height: ${L.qrSize}px; }
  @keyframes pop {
    to { opacity: 1; transform: scale(1); }
  }
  .outro-meta {
    font-size: ${L.metaSize}px; color: ${INK_MUTED}; margin-top: 6px;
    opacity: 0; animation: fade-in 600ms ease 900ms forwards;
    animation-play-state: paused;
  }
  body.go .outro-meta { animation-play-state: running; }
  .outro-meta .accent { color: ${INK}; font-weight: 600; }
</style>
</head>
<body>
  <div class="stage">

    <!-- Persistent corner brand mark (hidden during intro/outro) -->
    <div class="corner-mark">
      <span class="dot"></span>
      <span class="name">Readopp</span>
      <span class="sep">·</span>
      <span>${escapeHtml(domain)}</span>
    </div>

    <!-- Intro scene -->
    <section class="scene scene-intro" style="animation: scene-show ${INTRO_MS}ms ease ${introStart}ms both;">
      <div class="intro-eyebrow">An explainer</div>
      <h1 class="intro-title">${escapeHtml(explainer.title)}</h1>
      ${
        explainer.summary
          ? `<p class="intro-summary">${escapeHtml(explainer.summary)}</p>`
          : ""
      }
      <div class="intro-source">
        <span class="pip"></span>
        <span>${escapeHtml(domain)}</span>
      </div>
    </section>

    ${sceneHtml}

    <!-- Outro scene -->
    <section class="scene scene-outro" style="animation: scene-show-hold ${OUTRO_MS}ms ease ${outroStart}ms both;">
      <div class="outro-block">
        <div class="outro-eyebrow">Read the full explainer</div>
        <div class="outro-title">${escapeHtml(explainer.title)}</div>
        <div class="outro-qr">${qr}</div>
        <div class="outro-meta">
          <span class="accent">Readopp</span>
          <span> · scan or visit </span>
          <span class="accent">${escapeHtml(stripScheme(shareUrl))}</span>
        </div>
      </div>
    </section>
  </div>

  <script>
    // Two RAFs to make sure layout + first paint are settled before timing starts.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('go');
      });
    });
  </script>
</body>
</html>`,
  };
}

function renderScene(
  panel: RenderedPanel,
  i: number,
  shown: number,
  totalPanels: number,
  L: Layout,
  firstStart: number,
  stepMs: number
): string {
  const sceneStart = firstStart + i * stepMs;
  const isLast = i === shown - 1;
  // Last scene holds slightly so it doesn't fade out before the outro fades in.
  const dur = isLast ? SCENE_MS + 200 : SCENE_MS;

  const heading = panel.heading?.trim() || `Panel ${i + 1}`;
  const content = panelInnerHtml(panel);

  // Per-child SVG draw-in delays. The svg children animation-delay is relative
  // to the scene's start, so we offset by sceneStart + a small lead (300ms)
  // for the heading to land first.
  const svgChildLead = sceneStart + 280;
  const styleBlock = `
    .scene-panel[data-i="${i}"] .panel-num::before { animation-delay: ${sceneStart + 60}ms; }
    .scene-panel[data-i="${i}"] .panel-heading { animation-delay: ${sceneStart + 180}ms; }
    .scene-panel[data-i="${i}"] .panel-caption { animation-delay: ${sceneStart + 1300}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(1)  { animation-delay: ${svgChildLead}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(2)  { animation-delay: ${svgChildLead + 110}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(3)  { animation-delay: ${svgChildLead + 220}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(4)  { animation-delay: ${svgChildLead + 330}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(5)  { animation-delay: ${svgChildLead + 440}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(6)  { animation-delay: ${svgChildLead + 550}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(7)  { animation-delay: ${svgChildLead + 660}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(8)  { animation-delay: ${svgChildLead + 770}ms; }
    .scene-panel[data-i="${i}"] .panel-visual svg > *:nth-child(n+9) { animation-delay: ${svgChildLead + 880}ms; }
  `;

  return `<style>${styleBlock}</style>
<section class="scene scene-panel" data-i="${i}" style="animation: ${
    isLast ? "scene-show-hold" : "scene-show"
  } ${dur}ms ease ${sceneStart}ms both;">
  <div class="panel-header">
    <span class="panel-num">${String(i + 1).padStart(2, "0")} / ${String(
    totalPanels
  ).padStart(2, "0")}</span>
  </div>
  <h2 class="panel-heading">${escapeHtml(heading)}</h2>
  <div class="panel-visual">${content}</div>
  ${
    panel.caption
      ? `<p class="panel-caption">${escapeHtml(panel.caption)}</p>`
      : ""
  }
</section>`;
}

function panelInnerHtml(panel: RenderedPanel): string {
  if (panel.format === "svg") return panel.content;
  return `<div class="html-panel">${panel.content}</div>`;
}

function stripScheme(u: string): string {
  return u.replace(/^https?:\/\//, "");
}
