"use client";

import { DemoFrame, between, useDemoTick } from "./demoPrim";

const CYCLE_MS = 9000;

// Timeline (ms):
//   0    – 1400   Explainer view with Share button idle
//   1400 – 1900   Share button highlight + tap
//   1900 – 2400   Export sheet slides up
//   2400 – 3600   Format = Instagram (1:1), kind = PNG
//   3600 – 4600   Format = TikTok (9:16); kind flips to MP4 at 3900
//   4600 – 7200   Movie renders — progress bar fills 0 → 100%
//   7200 – 9000   Done — "Saved reel.mp4", play overlay on the preview
type Format = "instagram" | "tiktok" | "linkedin";

function currentFormat(t: number): Format | null {
  if (between(t, 2400, 3600)) return "instagram";
  if (t >= 3600) return "tiktok";
  return null;
}

const FORMAT_LABEL: Record<Format, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

const FORMAT_RATIO: Record<Format, { w: number; h: number; tag: string }> = {
  instagram: { w: 100, h: 100, tag: "1:1" },
  tiktok: { w: 56, h: 100, tag: "9:16" },
  linkedin: { w: 100, h: 52, tag: "1.91:1" },
};

export function Demo4Share() {
  const t = useDemoTick(CYCLE_MS);

  const shareTap = between(t, 1400, 1900);
  const sheetUp = t >= 1900;
  const fmt = currentFormat(t);
  const kind: "png" | "mp4" = t >= 3900 ? "mp4" : "png";
  const renderProgress = Math.min(1, Math.max(0, (t - 4600) / (7200 - 4600)));
  const rendering = t >= 4600 && t < 7200;
  const done = t >= 7200;

  return (
    // No frame label — the mock's own "Share ▾" button sits in that corner.
    <DemoFrame>
      <div className="relative h-[300px] sm:h-[320px]">
        {/* Background: a faded mock of the explainer page */}
        <div
          className={
            "absolute inset-0 transition-opacity duration-300 " +
            (sheetUp ? "opacity-30" : "opacity-100")
          }
        >
          <ExplainerMock shareTap={shareTap} />
        </div>
        {/* Export sheet slides up from bottom */}
        <div
          className={
            "absolute inset-x-0 bottom-0 transform transition-all duration-400 " +
            (sheetUp ? "translate-y-0 opacity-100" : "translate-y-full opacity-0")
          }
        >
          <ExportSheet
            fmt={fmt}
            kind={kind}
            rendering={rendering}
            renderProgress={renderProgress}
            done={done}
          />
        </div>
      </div>
    </DemoFrame>
  );
}

function ExplainerMock({ shareTap }: { shareTap: boolean }) {
  return (
    <div className="flex h-full flex-col bg-paper p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="h-3 w-3/4 rounded-sm bg-ink/70" />
          <div className="h-2 w-1/3 rounded-sm bg-ink/30" />
        </div>
        <div
          className={
            "shrink-0 rounded-md border bg-surface px-2.5 py-1 text-xs font-medium transition-all duration-200 " +
            (shareTap
              ? "border-sky text-sky-deep shadow-[0_0_0_3px_rgb(var(--c-sky)/0.2)]"
              : "border-paper-line text-ink-soft")
          }
        >
          Share ▾
        </div>
      </div>

      {/* One panel preview */}
      <div className="mt-3 rounded-md border border-paper-line bg-surface p-3">
        <svg viewBox="0 0 200 70" className="h-16 w-full" aria-hidden>
          <g transform="rotate(-90 48 36)">
            <circle cx="48" cy="36" r="17" fill="none" stroke="#F9E5D9" strokeWidth="9" />
            <circle
              cx="48"
              cy="36"
              r="17"
              fill="none"
              stroke="#E85D2A"
              strokeWidth="9"
              strokeDasharray="66.2 106.9"
            />
          </g>
          <rect x="110" y="44" width="14" height="22" rx="1.5" fill="#F9E5D9" />
          <rect x="130" y="32" width="14" height="34" rx="1.5" fill="#ECA77F" />
          <rect x="150" y="18" width="14" height="48" rx="1.5" fill="#E85D2A" />
          <line x1="104" y1="66" x2="170" y2="66" stroke="#171717" strokeWidth="1" opacity="0.5" />
        </svg>
        <div className="mt-2 h-1.5 w-3/4 rounded-sm bg-ink/20" />
        <div className="mt-1 h-1.5 w-2/3 rounded-sm bg-ink/15" />
      </div>
    </div>
  );
}

function ExportSheet({
  fmt,
  kind,
  rendering,
  renderProgress,
  done,
}: {
  fmt: Format | null;
  kind: "png" | "mp4";
  rendering: boolean;
  renderProgress: number;
  done: boolean;
}) {
  const tabs: Format[] = ["instagram", "tiktok", "linkedin"];
  return (
    <div className="rounded-t-xl border-t border-paper-line bg-surface p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {/* Format tabs + kind toggle */}
      <div className="flex items-center gap-1.5">
        {tabs.map((tabKey) => {
          const active = fmt === tabKey;
          return (
            <div
              key={tabKey}
              className={
                "flex-1 rounded-md border px-2 py-1 text-center text-[11px] font-medium transition-all duration-200 " +
                (active
                  ? "border-sky bg-sky-soft text-sky-deep"
                  : "border-paper-line bg-surface text-ink-muted")
              }
            >
              <div>{FORMAT_LABEL[tabKey]}</div>
              <div className="font-mono text-[9px] text-ink-faint">
                {FORMAT_RATIO[tabKey].tag}
              </div>
            </div>
          );
        })}
        <div className="ml-1 flex shrink-0 flex-col gap-1">
          {(["png", "mp4"] as const).map((k) => (
            <div
              key={k}
              className={
                "rounded-sm border px-1.5 py-0.5 text-center font-mono text-[9px] font-medium uppercase transition-all duration-200 " +
                (kind === k
                  ? "border-ink bg-ink text-paper"
                  : "border-paper-line bg-surface text-ink-faint")
              }
            >
              {k}
            </div>
          ))}
        </div>
      </div>

      {/* Preview that swaps aspect ratio, becomes a movie when MP4 */}
      <div className="mt-3 flex h-[120px] items-center justify-center rounded-md border border-paper-line bg-paper-soft p-2">
        {fmt ? (
          kind === "mp4" ? (
            <MoviePreview progress={done ? 1 : renderProgress} done={done} />
          ) : (
            <FormatPreview fmt={fmt} />
          )
        ) : null}
      </div>

      {/* Download / render button */}
      <div
        className={
          "relative mt-3 w-full overflow-hidden rounded-md text-center text-xs font-medium transition-all duration-200 " +
          (fmt ? "bg-sky text-white" : "bg-ink-faint text-paper opacity-70")
        }
      >
        {/* Render progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-sky-deep transition-[width] duration-150 ease-linear"
          style={{ width: rendering ? `${renderProgress * 100}%` : "0%" }}
        />
        <div className="relative px-3 py-2">
          {done ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckMini /> Saved · readopp-reel.mp4
            </span>
          ) : rendering ? (
            <span className="font-mono text-[11px]">
              Rendering movie… {Math.round(renderProgress * 100)}%
            </span>
          ) : (
            <>Download {fmt ? (kind === "mp4" ? "MP4" : "PNG") : "…"}</>
          )}
        </div>
      </div>
    </div>
  );
}

/** Vertical 9:16 movie frame: dark player, animated scene bar, scrubber. */
function MoviePreview({ progress, done }: { progress: number; done: boolean }) {
  const maxH = 96;
  const w = (9 / 16) * maxH;
  return (
    <div
      className="force-light relative overflow-hidden rounded-sm border border-ink/30 bg-dark animate-[demoSwap_300ms_ease-out]"
      style={{ width: `${w}px`, height: `${maxH}px` }}
    >
      {/* Tiny title scene */}
      <div className="absolute inset-x-1.5 top-2 space-y-0.5">
        <div className="h-1 w-3/4 rounded-sm bg-paper/80" />
        <div className="h-1 w-1/2 rounded-sm bg-paper/40" />
      </div>
      {/* Panel scene sliding as the movie "plays" */}
      <div
        className="absolute inset-x-1.5 top-7 h-10 rounded-[2px] bg-surface transition-transform duration-200"
        style={{ transform: `translateY(${(1 - progress) * 6}px)` }}
      >
        <svg viewBox="0 0 40 26" className="h-full w-full" aria-hidden>
          <g transform="rotate(-90 9 13)">
            <circle cx="9" cy="13" r="6" fill="none" stroke="#F9E5D9" strokeWidth="3.5" />
            <circle
              cx="9"
              cy="13"
              r="6"
              fill="none"
              stroke="#E85D2A"
              strokeWidth="3.5"
              strokeDasharray="23.4 37.7"
            />
          </g>
          <rect x="19" y="15" width="4.5" height="7" rx="0.8" fill="#F9E5D9" />
          <rect x="26" y="11" width="4.5" height="11" rx="0.8" fill="#ECA77F" />
          <rect x="33" y="6" width="4.5" height="16" rx="0.8" fill="#E85D2A" />
        </svg>
      </div>
      {/* Play overlay when done */}
      <div
        className={
          "absolute inset-0 flex items-center justify-center bg-dark/40 transition-opacity duration-300 " +
          (done ? "opacity-100" : "opacity-0")
        }
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper/90">
          <svg viewBox="0 0 10 10" className="ml-0.5 h-2.5 w-2.5" aria-hidden>
            <path d="M 1.5 0.5 L 9 5 L 1.5 9.5 Z" fill="#171717" />
          </svg>
        </span>
      </div>
      {/* Scrubber */}
      <div className="absolute inset-x-1.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-paper/25">
        <div
          className="h-full rounded-full bg-sky transition-[width] duration-150 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <style>{`
        @keyframes demoSwap {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function CheckMini() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5 L 6.5 12 L 13 4" />
    </svg>
  );
}

function FormatPreview({ fmt }: { fmt: Format }) {
  const { w, h } = FORMAT_RATIO[fmt];
  // Scale to fit the 120px-tall slot with some padding.
  const maxH = 96;
  const scaleH = maxH;
  const scaleW = (w / h) * maxH;
  return (
    <div
      key={fmt}
      className="overflow-hidden rounded-sm border border-paper-line bg-surface animate-[demoSwap_300ms_ease-out]"
      style={{ width: `${scaleW}px`, height: `${scaleH}px` }}
    >
      <div className="flex h-full flex-col p-1.5">
        <div className="h-1.5 w-3/4 rounded-sm bg-ink/40" />
        <div className="my-1 flex flex-1 items-center justify-center">
          <svg viewBox="0 0 60 36" className="h-full" aria-hidden>
            <g transform="rotate(-90 15 18)">
              <circle cx="15" cy="18" r="8" fill="none" stroke="#F9E5D9" strokeWidth="4.5" />
              <circle
                cx="15"
                cy="18"
                r="8"
                fill="none"
                stroke="#E85D2A"
                strokeWidth="4.5"
                strokeDasharray="31.2 50.3"
              />
            </g>
            <rect x="32" y="22" width="6" height="8" rx="1" fill="#F9E5D9" />
            <rect x="41" y="17" width="6" height="13" rx="1" fill="#ECA77F" />
            <rect x="50" y="10" width="6" height="20" rx="1" fill="#E85D2A" />
            <line x1="30" y1="30" x2="58" y2="30" stroke="#171717" strokeWidth="0.6" opacity="0.5" />
          </svg>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-1 w-8 rounded-sm bg-sky/40" />
          <div className="h-2 w-2 rounded-[1px] border border-ink/30" />
        </div>
      </div>
      <style>{`
        @keyframes demoSwap {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
