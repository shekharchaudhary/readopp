"use client";

import { useEffect, useRef, useState } from "react";
import { Demo1PasteUrl } from "./demos/Demo1PasteUrl";
import { Demo2AgentsWork } from "./demos/Demo2AgentsWork";
import { Demo3PanelsCompose } from "./demos/Demo3PanelsCompose";
import { Demo4Share } from "./demos/Demo4Share";

/**
 * One continuous product demo, styled like a marketing design video:
 * a player frame that auto-plays the four pipeline demos back to back,
 * with a clickable chapter rail and a synced caption. Each chapter's
 * duration matches the inner demo's own animation cycle, and chapters
 * remount their demo on entry so the loop starts from frame zero.
 */

interface Chapter {
  n: string;
  title: string;
  body: string;
  durationMs: number;
  demo: () => React.ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    n: "01",
    title: "Paste a URL",
    body: "Any article — a technical blog post, a research paper, a launch announcement, a long newsletter. Copy the URL, paste it here, and we strip away the chrome.",
    durationMs: 9000,
    demo: () => <Demo1PasteUrl />,
  },
  {
    n: "02",
    title: "Six agents read it",
    body: "Read, Understand, Outline, Plan, Draw, Assemble. Each agent does one job; you watch them step through their work in real time, with a transcript of every decision.",
    durationMs: 8500,
    demo: () => <Demo2AgentsWork />,
  },
  {
    n: "03",
    title: "Panels compose",
    body: "The planner picks the right visual for each section — audience donut, stat callout, reach chart. The renderer draws each panel from a deterministic template; no generic flowcharts.",
    durationMs: 8500,
    demo: () => <Demo3PanelsCompose />,
  },
  {
    n: "04",
    title: "Share it anywhere",
    body: "Export as a square for Instagram, vertical for TikTok or Reels, landscape for LinkedIn. Every frame carries a QR back to the live, editable explainer.",
    durationMs: 9000,
    demo: () => <Demo4Share />,
  },
];

export function AgentDemoReel() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runId, setRunId] = useState(0);
  const elapsedRef = useRef(0);
  const reducedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Play only while the player is on screen (and motion is allowed).
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mql.matches;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setPlaying(e.isIntersecting && !reducedRef.current);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Chapter clock. Anchored against elapsedRef so leaving and re-entering
  // the viewport resumes mid-chapter instead of restarting the bar.
  useEffect(() => {
    if (!playing) return;
    const dur = CHAPTERS[scene].durationMs;
    const anchor = performance.now() - elapsedRef.current;
    const id = setInterval(() => {
      const elapsed = performance.now() - anchor;
      if (elapsed >= dur) {
        elapsedRef.current = 0;
        setProgress(0);
        setRunId((r) => r + 1);
        setScene((s) => (s + 1) % CHAPTERS.length);
      } else {
        elapsedRef.current = elapsed;
        setProgress(elapsed / dur);
      }
    }, 100);
    return () => clearInterval(id);
  }, [playing, scene]);

  function seek(i: number) {
    elapsedRef.current = 0;
    setProgress(0);
    setRunId((r) => r + 1);
    setScene(i);
  }

  const chapter = CHAPTERS[scene];

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-paper-line bg-surface shadow-[0_1px_2px_rgba(23,23,23,0.04),0_24px_60px_-30px_rgba(23,23,23,0.18)]"
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-paper-line bg-paper-soft/60 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-paper-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-paper-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-paper-line" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Readopp — from read to post
        </span>
        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
          {chapter.n} / 04
        </span>
      </div>

      {/* Stage */}
      <div className="flex min-h-[320px] items-center bg-paper px-4 py-6 sm:min-h-[360px] sm:px-10 sm:py-8">
        <div
          key={`${scene}-${runId}`}
          className="mx-auto w-full max-w-xl animate-fade-up"
        >
          {chapter.demo()}
        </div>
      </div>

      {/* Synced caption */}
      <div className="border-t border-paper-line px-5 py-4 sm:px-8">
        <p
          key={scene}
          className="mx-auto max-w-2xl animate-fade-up text-center text-sm leading-relaxed text-ink-soft"
        >
          {chapter.body}
        </p>
      </div>

      {/* Chapter rail */}
      <div className="grid grid-cols-2 divide-x divide-y divide-paper-line border-t border-paper-line sm:grid-cols-4 sm:divide-y-0">
        {CHAPTERS.map((c, i) => {
          const fill = i < scene ? 1 : i === scene ? progress : 0;
          const active = i === scene;
          return (
            <button
              key={c.n}
              type="button"
              onClick={() => seek(i)}
              aria-current={active ? "step" : undefined}
              className={
                "group px-4 py-3.5 text-left transition-colors sm:px-5 " +
                (active ? "bg-paper-soft/50" : "hover:bg-paper-soft/40")
              }
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={
                    "font-mono text-[10px] tabular-nums " +
                    (active ? "text-accent" : "text-ink-faint")
                  }
                >
                  {c.n}
                </span>
                <span
                  className={
                    "truncate text-[13px] font-medium " +
                    (active ? "text-ink" : "text-ink-muted group-hover:text-ink")
                  }
                >
                  {c.title}
                </span>
              </span>
              <span className="mt-2.5 block h-0.5 overflow-hidden rounded-full bg-paper-line">
                <span
                  className="block h-full rounded-full bg-accent transition-[width] duration-150 ease-linear"
                  style={{ width: `${fill * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
