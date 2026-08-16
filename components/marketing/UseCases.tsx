"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { Squiggle } from "./Squiggle";

/**
 * "Who it's for" as an interactive persona switcher instead of a static
 * card grid. Left rail: four personas as an accordion that auto-rotates.
 * Right stage: that persona's actual before→after — their source file
 * flying into a template-styled mini panel via a hand-drawn arrow.
 * Panels use the orange artifact palette (product output), while the
 * chrome around them follows the site theme.
 */

const AUTO_MS = 6000;

type ToneId = "coral" | "sky" | "rose" | "butter";

/* Literal class strings so Tailwind's scanner sees every variant. */
const TONES: Record<
  ToneId,
  {
    kicker: string;
    active: string;
    hover: string;
    arrowIcon: string;
    bar: string;
    arrow: string;
  }
> = {
  coral: {
    kicker: "text-coral-deep",
    active: "border-coral/60 shadow-[0_16px_40px_-24px_rgb(var(--c-coral)/0.55)]",
    hover: "hover:border-coral/40",
    arrowIcon: "rotate-90 text-coral",
    bar: "bg-coral/70",
    arrow: "text-coral",
  },
  sky: {
    kicker: "text-sky-deep",
    active: "border-sky/60 shadow-[0_16px_40px_-24px_rgb(var(--c-sky)/0.55)]",
    hover: "hover:border-sky/40",
    arrowIcon: "rotate-90 text-sky",
    bar: "bg-sky/70",
    arrow: "text-sky",
  },
  rose: {
    kicker: "text-rose-deep",
    active: "border-rose/60 shadow-[0_16px_40px_-24px_rgb(var(--c-rose)/0.55)]",
    hover: "hover:border-rose/40",
    arrowIcon: "rotate-90 text-rose",
    bar: "bg-rose/70",
    arrow: "text-rose",
  },
  butter: {
    kicker: "text-butter-deep",
    active: "border-butter/60 shadow-[0_16px_40px_-24px_rgb(var(--c-butter)/0.55)]",
    hover: "hover:border-butter/40",
    arrowIcon: "rotate-90 text-butter",
    bar: "bg-butter/70",
    arrow: "text-butter",
  },
};

interface Persona {
  kicker: string;
  title: string;
  body: string;
  file: string;
  source: string;
  template: string;
  tone: ToneId;
  panel: ReactNode;
}

const PERSONAS: Persona[] = [
  {
    kicker: "Founders",
    title: "Turn launch notes into launch posts.",
    body: "Your changelog already explains the why. Readopp turns release notes, funding announcements, and product essays into carousels that read like a keynote slide, not a press release.",
    file: "launch-notes.md",
    source: "Launch announcement",
    template: "Bento Board",
    tone: "coral",
    panel: <BentoPanel />,
  },
  {
    kicker: "Engineers",
    title: "Make the RFC legible to the feed.",
    body: "The design doc was the hard part. Paste the post-mortem, the architecture write-up, or the arXiv paper and get panels that keep the precision — figures, trade-offs, terminal aesthetics intact.",
    file: "rfc-142-retrieval.md",
    source: "Technical deep-dive",
    template: "Engineering Spec",
    tone: "sky",
    panel: <SpecPanel />,
  },
  {
    kicker: "Writers",
    title: "Give the essay a second life.",
    body: "A newsletter issue dies in the inbox after 48 hours. The carousel version — pull-quote first, magazine typography — keeps sending readers back to the original for weeks.",
    file: "issue-48.html",
    source: "Newsletter essay",
    template: "Editorial Broadsheet",
    tone: "rose",
    panel: <BroadsheetPanel />,
  },
  {
    kicker: "Students",
    title: "Post what you study, as you study it.",
    body: "Reading a paper for class anyway? Turn it into a key-findings card and build a public record of what you're learning — the cheapest credibility a student can buy.",
    file: "attention.pdf",
    source: "Research paper",
    template: "Index Card",
    tone: "butter",
    panel: <IndexCardPanel />,
  },
];

export function UseCases() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const hovering = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Don't start the auto-cycle until the section actually scrolls in;
  // otherwise the personas advance before the user is looking at them.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One cycle per active persona; re-arms on every change so a manual
  // pick always gets a full cycle. Hover pauses the advance (not the bar
  // — close enough, and the bar restarting on resume reads fine).
  useEffect(() => {
    if (reduced || !inView) return;
    const id = setTimeout(() => {
      if (hovering.current) return;
      setActive((a) => (a + 1) % PERSONAS.length);
    }, AUTO_MS);
    return () => clearTimeout(id);
  }, [active, reduced, inView]);

  const p = PERSONAS[active];

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className="section-amb amb-lavender border-b border-paper-line bg-surface"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <SectionLabel title="Who it's for" tone="lavender" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
            Different readers, same problem: the good stuff{" "}
            <Squiggle>never leaves</Squiggle> the tab.
          </h2>
        </Reveal>

        <div
          className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16"
          onMouseEnter={() => (hovering.current = true)}
          onMouseLeave={() => (hovering.current = false)}
        >
          {/* Persona rail */}
          <Reveal delayMs={140}>
            <div className="flex flex-col gap-2.5">
              {PERSONAS.map((persona, i) => {
                const isActive = i === active;
                const tone = TONES[persona.tone];
                return (
                  <button
                    key={persona.kicker}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-expanded={isActive}
                    className={`relative overflow-hidden rounded-2xl border px-6 py-5 text-left transition-all duration-300 sm:px-7 ${
                      isActive
                        ? `bg-surface ${tone.active}`
                        : `border-paper-line bg-surface ${tone.hover}`
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                          isActive ? tone.kicker : "text-ink-muted"
                        }`}
                      >
                        {persona.kicker}
                      </span>
                      <span
                        aria-hidden
                        className={`text-ink-faint transition-transform duration-300 ${
                          isActive ? tone.arrowIcon : ""
                        }`}
                      >
                        →
                      </span>
                    </div>
                    <span className="mt-2 block font-display text-lg font-medium tracking-tight text-ink sm:text-xl">
                      {persona.title}
                    </span>

                    {/* Body expands only for the active persona */}
                    <div
                      className="grid transition-[grid-template-rows] duration-500 ease-out"
                      style={{ gridTemplateRows: isActive ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="pt-3 text-[14.5px] leading-relaxed text-ink-soft">
                          {persona.body}
                        </p>
                        <p className="mt-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                          {persona.source}{" "}
                          <span aria-hidden className="text-ink-faint">→</span>{" "}
                          <span className="text-ink">{persona.template}</span>
                        </p>
                      </div>
                    </div>

                    {/* Auto-advance progress */}
                    {isActive && !reduced && (
                      <span
                        key={`bar-${active}`}
                        className={`uc-progress absolute bottom-0 left-0 h-[2px] motion-reduce:hidden ${tone.bar}`}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* Stage: source file → arrow → template panel */}
          <Reveal delayMs={220}>
            <div className="relative overflow-hidden rounded-2xl border border-paper-line bg-paper p-6 sm:p-10">
              <div
                key={`${active}-${inView ? "v" : "h"}`}
                className="relative mx-auto max-w-[320px] pt-10"
              >
                {/* Source file chip */}
                <div className="absolute -top-1 left-0 z-10 -rotate-3">
                  <div className="uc-chip flex items-center gap-2 rounded-lg border border-paper-line bg-surface px-3 py-2 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)]">
                    <FileGlyph />
                    <span className="font-mono text-[11px] text-ink">
                      {p.file}
                    </span>
                  </div>
                </div>

                {/* Hand-drawn arrow from chip into the panel */}
                <svg
                  aria-hidden
                  viewBox="0 0 120 60"
                  className={`uc-arrow absolute -top-2 left-36 h-12 w-24 ${TONES[p.tone].arrow}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d="M6 14 C 40 2, 84 10, 102 40"
                    pathLength={1}
                    className="uc-arrow-path"
                  />
                  <path
                    d="M88 36 L 104 44 L 102 26"
                    pathLength={1}
                    className="uc-arrow-path"
                    style={{ animationDelay: "520ms" }}
                  />
                </svg>

                {/* The template panel */}
                <div className="uc-panel overflow-hidden rounded-xl border border-paper-line shadow-[0_24px_50px_-24px_rgba(0,0,0,0.45)]">
                  {p.panel}
                </div>

                <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  {p.template}{" "}
                  <span className="text-ink-faint">· panel 1 of 5</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <style jsx>{`
        :global(.uc-chip) {
          animation: ucChip 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        :global(.uc-arrow-path) {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: ucDraw 500ms ease-out 250ms forwards;
        }
        :global(.uc-panel) {
          animation: ucPanel 600ms cubic-bezier(0.22, 1, 0.36, 1) 350ms both;
        }
        :global(.uc-progress) {
          animation: ucProgress ${AUTO_MS}ms linear forwards;
        }
        @keyframes ucChip {
          from { opacity: 0; transform: translate(-14px, -8px); }
          to { opacity: 1; transform: translate(0, 0); }
        }
        @keyframes ucDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes ucPanel {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ucProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.uc-chip),
          :global(.uc-panel) {
            animation: none;
          }
          :global(.uc-arrow-path) {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </section>
  );
}

function FileGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="text-accent">
      <path d="M4 2h5l3 3v9H4V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ——— Template mini-panels (artifact palette: cream + orange) ——— */

const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function BentoPanel() {
  return (
    <svg viewBox="0 0 300 300" role="img" className="block w-full" fontFamily="ui-sans-serif, system-ui">
      <title>Bento Board panel</title>
      <rect width="300" height="300" fill="#FFFDF8" />
      <rect x="24" y="24" width="24" height="4" rx="2" fill="#E85D2A" />
      <text x="24" y="54" fontSize="19" fontWeight="600" fill="#171717" fontFamily={SERIF}>Launch, visualized</text>
      <rect x="24" y="72" width="122" height="100" rx="10" fill="#F9E5D9" />
      <text x="40" y="122" fontSize="32" fontWeight="600" fill="#B23F14" fontFamily={SERIF}>3.1&#215;</text>
      <text x="40" y="142" fontSize="10" fill="#8F3210">faster onboarding</text>
      <rect x="154" y="72" width="122" height="100" rx="10" fill="#101010" />
      <text x="170" y="100" fontSize="12" fontWeight="600" fill="#F7F3EA">Ships today</text>
      <rect x="170" y="116" width="76" height="6" rx="3" fill="#E85D2A" />
      <rect x="170" y="130" width="52" height="6" rx="3" fill="#E85D2A" opacity="0.55" />
      <rect x="170" y="144" width="90" height="6" rx="3" fill="#E85D2A" opacity="0.3" />
      <rect x="24" y="180" width="122" height="96" rx="10" fill="#FFFDF8" stroke="#D8CEC0" strokeWidth="1.5" />
      <text x="40" y="208" fontSize="11" fontWeight="600" fill="#171717">Why now</text>
      <rect x="40" y="222" width="86" height="5" rx="2.5" fill="#171717" opacity="0.14" />
      <rect x="40" y="234" width="72" height="5" rx="2.5" fill="#171717" opacity="0.14" />
      <rect x="40" y="246" width="80" height="5" rx="2.5" fill="#171717" opacity="0.14" />
      <rect x="154" y="180" width="122" height="96" rx="10" fill="#ECA77F" />
      <text x="170" y="212" fontSize="22" fontWeight="600" fill="#171717" fontFamily={SERIF}>$2.4M</text>
      <text x="170" y="232" fontSize="10" fill="#8F3210">seed, led by readers</text>
    </svg>
  );
}

function SpecPanel() {
  return (
    <svg viewBox="0 0 300 300" role="img" className="block w-full" fontFamily={MONO}>
      <title>Engineering Spec panel</title>
      <rect width="300" height="300" fill="#101010" />
      <text x="24" y="36" fontSize="10" fill="#ABA395" letterSpacing="2">SPEC-142 · RETRIEVAL PATH</text>
      <line x1="24" y1="48" x2="276" y2="48" stroke="#2E2E2E" strokeWidth="1.5" />
      <rect x="24" y="68" width="110" height="40" rx="8" fill="none" stroke="#ECA77F" strokeWidth="1.5" />
      <text x="40" y="92" fontSize="11" fill="#F7F3EA">QUERY</text>
      <path d="M79 108 v 18" stroke="#E85D2A" strokeWidth="2" />
      <path d="M74 120 L 79 128 L 84 120" fill="none" stroke="#E85D2A" strokeWidth="2" />
      <rect x="24" y="132" width="110" height="40" rx="8" fill="none" stroke="#E85D2A" strokeWidth="1.5" />
      <text x="40" y="156" fontSize="11" fill="#F7F3EA">RANKER</text>
      <path d="M79 172 v 18" stroke="#E85D2A" strokeWidth="2" />
      <path d="M74 184 L 79 192 L 84 184" fill="none" stroke="#E85D2A" strokeWidth="2" />
      <rect x="24" y="196" width="110" height="40" rx="8" fill="#E85D2A" />
      <text x="40" y="220" fontSize="11" fontWeight="600" fill="#101010">INDEX</text>
      <text x="166" y="160" fontSize="44" fontWeight="500" fill="#F7F3EA" fontFamily={SERIF}>41ms</text>
      <text x="166" y="182" fontSize="10" fill="#ABA395">p99, after the rewrite</text>
      <line x1="24" y1="260" x2="276" y2="260" stroke="#2E2E2E" strokeWidth="1.5" />
      <text x="24" y="282" fontSize="9" fill="#857E72">TRADE-OFF: RECALL −2% · LATENCY −78%</text>
    </svg>
  );
}

function BroadsheetPanel() {
  return (
    <svg viewBox="0 0 300 300" role="img" className="block w-full" fontFamily="ui-sans-serif, system-ui">
      <title>Editorial Broadsheet panel</title>
      <rect width="300" height="300" fill="#FFFDF8" />
      <text x="150" y="34" fontSize="9" fill="#857E72" textAnchor="middle" fontFamily={MONO} letterSpacing="3">THE SUNDAY ISSUE · NO. 48</text>
      <line x1="24" y1="46" x2="276" y2="46" stroke="#171717" strokeWidth="2" />
      <line x1="24" y1="51" x2="276" y2="51" stroke="#171717" strokeWidth="0.75" />
      <text x="24" y="100" fontSize="23" fontWeight="500" fill="#171717" fontFamily={SERIF} fontStyle="italic">&ldquo;Attention is the</text>
      <text x="24" y="130" fontSize="23" fontWeight="500" fill="#171717" fontFamily={SERIF} fontStyle="italic">scarcest resource.&rdquo;</text>
      <rect x="24" y="146" width="34" height="4" rx="2" fill="#E85D2A" />
      <line x1="24" y1="172" x2="276" y2="172" stroke="#D8CEC0" strokeWidth="1" />
      {[0, 1].map((col) => (
        <g key={col} transform={`translate(${24 + col * 132} 190)`}>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <rect
              key={row}
              y={row * 14}
              width={row === 5 ? 76 : 120}
              height="5"
              rx="2.5"
              fill="#171717"
              opacity="0.13"
            />
          ))}
        </g>
      ))}
      <rect x="24" y="186" width="14" height="14" fill="#E85D2A" />
    </svg>
  );
}

function IndexCardPanel() {
  return (
    <svg viewBox="0 0 300 300" role="img" className="block w-full" fontFamily="ui-sans-serif, system-ui">
      <title>Index Card panel</title>
      <rect width="300" height="300" fill="#FFFDF8" />
      {[92, 122, 152, 182, 212, 242, 272].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#D8CEC0" strokeWidth="1" />
      ))}
      <line x1="48" y1="0" x2="48" y2="300" stroke="#E85D2A" strokeWidth="1.5" opacity="0.6" />
      <text x="60" y="48" fontSize="20" fontWeight="600" fill="#171717" fontFamily={SERIF}>Key findings</text>
      <text x="252" y="32" fontSize="9" fill="#ABA395" fontFamily={MONO}>PG 1/3</text>
      {[
        { y: 112, w: 168 },
        { y: 142, w: 196 },
        { y: 172, w: 150 },
      ].map((l, i) => (
        <g key={i}>
          <path
            d={`M60 ${l.y - 6} l 4 5 l 8 -9`}
            fill="none"
            stroke="#E85D2A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="82" y={l.y - 10} width={l.w} height="7" rx="3.5" fill="#171717" opacity="0.16" />
        </g>
      ))}
      <rect x="60" y="232" width="120" height="26" rx="13" fill="#F9E5D9" />
      <text x="74" y="249" fontSize="10" fill="#8F3210" fontFamily={MONO}>self-attention &gt; RNN</text>
    </svg>
  );
}
