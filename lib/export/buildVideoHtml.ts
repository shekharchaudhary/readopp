import QRCode from "qrcode";
import type { BrandKit, Explainer, PublishingGoal } from "../shared/schemas";
import { sourceLabel } from "../shared/source";
import type { TemplateDef } from "../templates/types";

/** Per-format dimensions and typography for video output. */
export type VideoFormat = "vertical" | "square";
export type VideoPreset = "native" | "cinematic";

export const VIDEO_DIMENSIONS: Record<
  VideoFormat,
  { w: number; h: number; label: string }
> = {
  vertical: { w: 1080, h: 1920, label: "LinkedIn / Reels / Shorts" },
  square: { w: 1080, h: 1080, label: "LinkedIn / Instagram feed" },
};

export function isVideoFormat(s: string): s is VideoFormat {
  return s === "vertical" || s === "square";
}

// Max panels in a video. More than this becomes too long for short-form feeds.
const MAX_PANELS = 6;

const VIDEO_TIMING: Record<VideoPreset, { intro: number; scene: number; crossfade: number; outro: number }> = {
  native: { intro: 1800, scene: 3300, crossfade: 400, outro: 2600 },
  cinematic: { intro: 2400, scene: 4200, crossfade: 500, outro: 3200 },
};

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
    color: { dark: "#1a1a1a", light: "#00000000" },
    errorCorrectionLevel: "M",
  });
}

interface Layout {
  padding: number;
  heroSize: number;
  captionSize: number;
  metaSize: number;
  qrSize: number;
}

function layoutFor(format: VideoFormat): Layout {
  switch (format) {
    case "vertical":
      return {
        padding: 80,
        heroSize: 80,
        captionSize: 32,
        metaSize: 24,
        qrSize: 180,
      };
    case "square":
      return {
        padding: 64,
        heroSize: 54,
        captionSize: 24,
        metaSize: 18,
        qrSize: 140,
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
  preset?: VideoPreset;
  /** Visual identity to render panel scenes with — same contract as the
   *  image export, so the video always matches what the user picked. */
  template: TemplateDef;
  brand?: BrandKit | null;
}

/**
 * Build a single self-contained HTML doc that auto-plays as a timed slideshow.
 *
 * Panel scenes embed the explainer's template renderer output (the same
 * full-bleed slides the PNG export produces) inside sandboxed iframes, so
 * switching templates changes the video too. Scenes cross-fade in place with
 * a slow zoom for motion. Animations start paused; a tiny inline script flips
 * `body.go` once every iframe has loaded — the recorder's timing starts from
 * document load, so scenes must already be settled by then.
 */
export async function buildVideoHtml(input: BuildInput): Promise<VideoBuild> {
  const { explainer, format, template, brand, preset = "native" } = input;
  const timing = VIDEO_TIMING[preset];
  const dims = VIDEO_DIMENSIONS[format];
  const L = layoutFor(format);
  const panels = explainer.panels.slice(0, MAX_PANELS);
  const totalPanels = explainer.panels.length;
  const shown = panels.length;
  const domain = sourceLabel(explainer.url);
  const shareUrl = `${siteUrl()}/e/${explainer.id}`;
  const qr = await qrSvg(shareUrl, L.qrSize);
  const { hook, cta, ctaEyebrow } = videoCopy(explainer);
  const showCaptions = preset === "native";

  // Theme the intro/outro chrome from the template's identity so the video
  // reads as one piece, even though those scenes are video-specific.
  const BG = template.preview.background;
  const INK = template.preview.foreground;
  const ACCENT = template.preview.accent;
  const FONT = template.preview.fontFamily;
  const INK_SOFT = `color-mix(in srgb, ${INK} 80%, ${BG})`;
  const INK_MUTED = `color-mix(in srgb, ${INK} 58%, ${BG})`;
  const LINE = `color-mix(in srgb, ${INK} 16%, ${BG})`;

  // Render every panel through the template — identical inputs to the
  // PNG export, and "vertical" / "square" are valid export formats with
  // the same pixel dimensions.
  const slides = await Promise.all(
    panels.map((panel, i) =>
      template.renderPanel({
        explainer,
        panel,
        format,
        panelIndex: i + 1,
        totalPanels,
        brand,
      })
    )
  );

  // Scene timing: each scene starts staggered by (SCENE_MS - CROSSFADE_MS).
  const stepMs = timing.scene - timing.crossfade;
  const introStart = 0;
  const firstSceneStart = timing.intro - timing.crossfade;
  const outroStart = firstSceneStart + shown * stepMs;
  const totalMs = outroStart + timing.outro;

  const sceneHtml = slides
    .map((slide, i) => renderScene(slide, panels[i]?.heading || panels[i]?.caption || "", i, shown, firstSceneStart, stepMs, timing.scene, showCaptions))
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
  html, body { margin: 0; padding: 0; background: ${BG}; color: ${INK};
    font-family: ${FONT};
    -webkit-font-smoothing: antialiased;
  }
  body { width: ${dims.w}px; height: ${dims.h}px; overflow: hidden; }

  .stage {
    position: relative;
    width: ${dims.w}px;
    height: ${dims.h}px;
    background: ${BG};
  }
  .timeline { position: absolute; z-index: 20; top: 0; left: 0; height: 8px; width: 100%; background: ${LINE}; }
  .timeline-fill { height: 100%; width: 0; background: ${ACCENT}; animation: timeline ${totalMs}ms linear forwards; animation-play-state: paused; }
  body.go .timeline-fill { animation-play-state: running; }
  @keyframes timeline { to { width: 100%; } }

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

  /* -------- Panel scenes: full-bleed templated slides -------- */
  .scene-panel { padding: 0; }
  .panel-zoom {
    position: absolute; inset: 0;
    transform-origin: 50% 50%;
    animation: panel-zoom ${timing.scene}ms linear both;
    animation-play-state: paused;
  }
  body.go .panel-zoom { animation-play-state: running; }
  @keyframes panel-zoom {
    from { transform: scale(1); }
    to { transform: scale(1.035); }
  }
  .panel-frame {
    display: block; width: ${dims.w}px; height: ${dims.h}px;
    border: 0; pointer-events: none; background: ${BG};
  }
  .scene-count { position: absolute; z-index: 6; top: ${format === "vertical" ? 58 : 42}px; right: ${format === "vertical" ? 54 : 42}px; padding: 10px 16px; border-radius: 999px; background: rgba(10,10,10,.72); color: white; font: 600 ${L.metaSize}px/1 ${FONT}; letter-spacing: .08em; backdrop-filter: blur(12px); }
  .scene-caption { position: absolute; z-index: 5; left: ${L.padding}px; right: ${L.padding}px; bottom: ${format === "vertical" ? 82 : 54}px; padding: 24px 28px; border-radius: 20px; background: rgba(10,10,10,.82); color: white; font: 600 ${L.captionSize}px/1.25 ${FONT}; letter-spacing: -.01em; box-shadow: 0 12px 40px rgba(0,0,0,.22); backdrop-filter: blur(16px); }

  @keyframes rise {
    to { opacity: 1; transform: translateY(0); }
  }

  /* -------- Outro scene -------- */
  /* Opaque background so the held last panel doesn't show through after the crossfade. */
  .scene-outro { justify-content: center; align-items: center; text-align: center; background: ${BG}; }
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
    border: 1px solid ${LINE}; border-radius: 18px; line-height: 0;
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
    <div class="timeline"><div class="timeline-fill"></div></div>

    <!-- Intro scene -->
    <section class="scene scene-intro" style="animation: scene-show ${timing.intro}ms ease ${introStart}ms both;">
      <div class="intro-eyebrow">${escapeHtml(hook)}</div>
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
    <section class="scene scene-outro" style="animation: scene-show-hold ${timing.outro}ms ease ${outroStart}ms both;">
      <div class="outro-block">
        <div class="outro-eyebrow">${escapeHtml(ctaEyebrow)}</div>
        <div class="outro-title">${escapeHtml(cta)}</div>
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
    // Wait for every templated slide iframe to finish loading, then two RAFs
    // so layout + first paint are settled before the timeline starts.
    const frames = Array.from(document.querySelectorAll('iframe'));
    Promise.all(
      frames.map((f) => new Promise((resolve) => {
        try {
          if (f.contentDocument && f.contentDocument.readyState === 'complete') {
            resolve(); return;
          }
        } catch (e) {}
        f.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 3000);
      }))
    ).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.add('go');
        });
      });
    });
  </script>
</body>
</html>`,
  };
}

function renderScene(
  slideHtml: string,
  caption: string,
  i: number,
  shown: number,
  firstStart: number,
  stepMs: number,
  sceneMs: number,
  showCaption: boolean
): string {
  const sceneStart = firstStart + i * stepMs;
  const isLast = i === shown - 1;
  // Last scene holds slightly so it doesn't fade out before the outro fades in.
  const dur = isLast ? sceneMs + 200 : sceneMs;

  return `<section class="scene scene-panel" data-i="${i}" style="animation: ${
    isLast ? "scene-show-hold" : "scene-show"
  } ${dur}ms ease ${sceneStart}ms both;">
  <div class="panel-zoom" style="animation-delay: ${sceneStart}ms;">
    <iframe class="panel-frame" scrolling="no" srcdoc="${escapeHtml(
      slideHtml
    )}"></iframe>
  </div>
  <div class="scene-count">${String(i + 1).padStart(2, "0")} / ${String(shown).padStart(2, "0")}</div>
  ${showCaption && caption ? `<div class="scene-caption">${escapeHtml(truncate(caption, 120))}</div>` : ""}
</section>`;
}

function videoCopy(explainer: Explainer): { hook: string; cta: string; ctaEyebrow: string } {
  const goal: PublishingGoal = explainer.publishingGoal;
  const hooks: Record<PublishingGoal, string> = {
    teach: "Understand this in seconds",
    key_findings: "The finding worth knowing",
    make_argument: "The case, made clearly",
    promote_source: "Before you read this",
    start_discussion: "A question worth debating",
  };
  const ctas: Record<PublishingGoal, [string, string]> = {
    teach: ["Keep learning", "Save this explainer"],
    key_findings: ["Go deeper", "Explore the evidence"],
    make_argument: ["Your turn", "Do you agree?"],
    promote_source: ["Continue reading", "Read the full source"],
    start_discussion: ["Join the conversation", "Add your perspective"],
  };
  const [ctaEyebrow, cta] = ctas[goal];
  return { hook: hooks[goal], cta, ctaEyebrow };
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function stripScheme(u: string): string {
  return u.replace(/^https?:\/\//, "");
}
