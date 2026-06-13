"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const AUTO_MS = 5000;

/**
 * Tabbed specimen gallery for the template library. One tab per
 * category, each specimen a bespoke mini-render of the actual format
 * it represents — a receipt looks like a receipt, a magazine cover
 * looks like a magazine cover, a terminal looks like a terminal. The
 * whole point of Readopp's templates is that they borrow trust from
 * formats people already recognize, so the showcase should *show*
 * the format, not narrate it from a generic card with a label that
 * says "Receipt".
 */

type TemplateId =
  | "editorial-broadsheet"
  | "magazine-cover"
  | "new-yorker-frame"
  | "terminal-brutalist"
  | "engineering-spec"
  | "notebook-cell"
  | "receipt"
  | "index-card"
  | "boarding-pass"
  | "highlighter-reader"
  | "sticky-notes"
  | "kindle-highlight"
  | "editorial-brutalist"
  | "tabloid-splash"
  | "risograph-zine"
  | "galaxy-brain"
  | "aurora-glass"
  | "bento-grid"
  | "swiss-poster";

interface TemplateMeta {
  id: TemplateId;
  name: string;
  tagline: string;
}

type ToneId = "sky" | "rose" | "lavender" | "butter" | "accent" | "coral";

/* Literal class strings so Tailwind's scanner picks up every variant. */
const TONES: Record<
  ToneId,
  { tab: string; bar: string; index: string }
> = {
  sky: {
    tab: "border-sky/60 bg-sky-soft text-sky-deep",
    bar: "bg-sky",
    index: "text-sky-deep",
  },
  rose: {
    tab: "border-rose/60 bg-rose-soft text-rose-deep",
    bar: "bg-rose",
    index: "text-rose-deep",
  },
  lavender: {
    tab: "border-lavender/60 bg-lavender-soft text-lavender-deep",
    bar: "bg-lavender",
    index: "text-lavender-deep",
  },
  butter: {
    tab: "border-butter/60 bg-butter-soft text-butter-deep",
    bar: "bg-butter",
    index: "text-butter-deep",
  },
  accent: {
    tab: "border-accent/60 bg-accent-soft text-accent-deep",
    bar: "bg-accent",
    index: "text-accent-deep",
  },
  coral: {
    tab: "border-coral/60 bg-coral-soft text-coral-deep",
    bar: "bg-coral",
    index: "text-coral-deep",
  },
};

interface Chapter {
  name: string;
  caption: string;
  tone: ToneId;
  templates: TemplateMeta[];
}

const CHAPTERS: Chapter[] = [
  {
    name: "Modern",
    tone: "sky",
    caption: "Launch-day looks — glass, bento, and the grid.",
    templates: [
      {
        id: "aurora-glass",
        name: "Aurora Glass",
        tagline: "Dark glass card, aurora glow.",
      },
      {
        id: "bento-grid",
        name: "Bento Board",
        tagline: "Keynote-style bento tiles.",
      },
      {
        id: "swiss-poster",
        name: "Swiss Poster",
        tagline: "Müller-Brockmann grid discipline.",
      },
    ],
  },
  {
    name: "Editorial",
    tone: "rose",
    caption: "Magazine-page seriousness for longform writers.",
    templates: [
      {
        id: "editorial-broadsheet",
        name: "Editorial Broadsheet",
        tagline: "FT Weekend grid with drop caps.",
      },
      {
        id: "magazine-cover",
        name: "Magazine Cover",
        tagline: "Full-bleed display serif.",
      },
      {
        id: "new-yorker-frame",
        name: "New Yorker Frame",
        tagline: "Thin border, Caslon, magazine page.",
      },
    ],
  },
  {
    name: "Technical",
    tone: "lavender",
    caption: "For founders and engineers who think in monospace.",
    templates: [
      {
        id: "terminal-brutalist",
        name: "Terminal Brutalist",
        tagline: "Monospace, ASCII rules, neon accent.",
      },
      {
        id: "engineering-spec",
        name: "Engineering Spec",
        tagline: "RFC-style design doc.",
      },
      {
        id: "notebook-cell",
        name: "Notebook Cell",
        tagline: "Jupyter input/output cell.",
      },
    ],
  },
  {
    name: "Document",
    tone: "butter",
    caption: "Borrow trust from familiar paper forms.",
    templates: [
      {
        id: "receipt",
        name: "Receipt",
        tagline: "Thermal-paper receipt with barcode.",
      },
      {
        id: "index-card",
        name: "Index Card",
        tagline: "Ruled Zettelkasten card.",
      },
      {
        id: "boarding-pass",
        name: "Boarding Pass",
        tagline: "Airline ticket with tear-off stub.",
      },
    ],
  },
  {
    name: "Reader",
    tone: "accent",
    caption: "For people who post what they're reading.",
    templates: [
      {
        id: "highlighter-reader",
        name: "Highlighter Reader",
        tagline: "Marked-up PDF excerpt.",
      },
      {
        id: "sticky-notes",
        name: "Sticky Notes",
        tagline: "Overlapped Post-it notes.",
      },
      {
        id: "kindle-highlight",
        name: "Kindle Highlight",
        tagline: "E-reader page with location markers.",
      },
    ],
  },
  {
    name: "Bold",
    tone: "coral",
    caption: "For loud opinions that earn their space on the feed.",
    templates: [
      {
        id: "editorial-brutalist",
        name: "Editorial Brutalist",
        tagline: "Pentagram-scale type.",
      },
      {
        id: "tabloid-splash",
        name: "Tabloid Splash",
        tagline: "Tabloid front-page energy.",
      },
      {
        id: "galaxy-brain",
        name: "Galaxy Brain",
        tagline: "Expanding-brain meme, tastefully cosmic.",
      },
      {
        id: "risograph-zine",
        name: "Risograph Zine",
        tagline: "Two-color riso with misregistration.",
      },
    ],
  },
];

export function TemplateLibraryShowcase() {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const chapter = CHAPTERS[active];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Auto-advance through the categories like a slideshow. Hovering
  // anywhere in the showcase pauses it; leaving re-arms a full cycle
  // (the progress bar is re-keyed on both so it stays in sync).
  useEffect(() => {
    if (reduced || hover) return;
    const id = setTimeout(
      () => setActive((a) => (a + 1) % CHAPTERS.length),
      AUTO_MS
    );
    return () => clearTimeout(id);
  }, [active, hover, reduced]);

  return (
    <div
      className="mt-12 sm:mt-16"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Category tabs */}
      <div
        role="tablist"
        aria-label="Template categories"
        className="flex flex-wrap items-center gap-2"
      >
        {CHAPTERS.map((c, i) => (
          <button
            key={c.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={
              "relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-sm font-medium transition " +
              (i === active
                ? TONES[c.tone].tab
                : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted hover:text-ink")
            }
          >
            {c.name}
            <span
              className={
                "font-mono text-[10px] tabular-nums " +
                (i === active ? "text-current opacity-60" : "text-ink-faint")
              }
            >
              {c.templates.length}
            </span>
            {i === active && !reduced && (
              <span
                key={`${active}-${hover ? "p" : "r"}`}
                aria-hidden
                className={`tl-progress absolute bottom-0 left-0 h-[2px] ${TONES[c.tone].bar}`}
                style={{ animationPlayState: hover ? "paused" : "running" }}
              />
            )}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm text-ink-soft sm:text-base">
        {chapter.caption}
      </p>

      {/* Specimens for the active category. Keyed by chapter name so
          switching tabs remounts the grid and replays the deal-in. */}
      <div
        key={`grid-${chapter.name}`}
        className="mt-8 grid gap-7"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        }}
      >
        {chapter.templates.map((t, i) => (
          <FormatCard
            key={t.id}
            template={t}
            index={i}
            indexClass={TONES[chapter.tone].index}
          />
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <Link
          href="#try"
          className="group inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition hover:brightness-110"
        >
          Try a template
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>

      <style jsx>{`
        :global(.tl-card) {
          opacity: 0;
          animation: tlDeal 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes tlDeal {
          from {
            opacity: 0;
            transform: translateY(28px) scale(0.96) rotate(var(--rot, 0deg));
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
        }
        :global(.tl-progress) {
          animation: tlProgress ${AUTO_MS}ms linear forwards;
        }
        @keyframes tlProgress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        :global(.tl-sheen) {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.16) 50%,
            transparent 60%
          );
          transform: translateX(-130%);
          pointer-events: none;
        }
        :global(.tl-card:hover .tl-sheen) {
          transform: translateX(130%);
          transition: transform 0.9s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.tl-card) {
            opacity: 1;
            animation: none;
          }
          :global(.tl-sheen) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function FormatCard({
  template,
  index,
  indexClass,
}: {
  template: TemplateMeta;
  index: number;
  indexClass: string;
}) {
  // Alternate a slight resting tilt so the row reads like specimens
  // laid on a table; cards straighten when you pick one up (hover).
  const rot = index % 2 === 0 ? "-1deg" : "1.2deg";
  return (
    <article
      className="tl-card group"
      style={
        {
          "--rot": rot,
          animationDelay: `${index * 110}ms`,
        } as React.CSSProperties
      }
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-paper-line bg-surface shadow-[0_2px_6px_rgba(23,23,23,0.05)] transition-all duration-500 rotate-[var(--rot)] group-hover:rotate-0 group-hover:-translate-y-2 group-hover:shadow-[0_30px_60px_-25px_rgba(23,23,23,0.35)]">
        <FormatPreview templateId={template.id} />
        <div className="tl-sheen" aria-hidden />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 px-1">
        <div className="text-sm font-medium text-ink">
          <span
            className={`mr-2 font-mono text-[10px] tabular-nums ${indexClass}`}
          >
            0{index + 1}
          </span>
          {template.name}
        </div>
        <div className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {template.tagline}
        </div>
      </div>
    </article>
  );
}

function FormatPreview({ templateId }: { templateId: TemplateId }) {
  switch (templateId) {
    case "editorial-broadsheet":
      return <EditorialBroadsheetPreview />;
    case "magazine-cover":
      return <MagazineCoverPreview />;
    case "new-yorker-frame":
      return <NewYorkerFramePreview />;
    case "terminal-brutalist":
      return <TerminalBrutalistPreview />;
    case "engineering-spec":
      return <EngineeringSpecPreview />;
    case "notebook-cell":
      return <NotebookCellPreview />;
    case "receipt":
      return <ReceiptPreview />;
    case "index-card":
      return <IndexCardPreview />;
    case "boarding-pass":
      return <BoardingPassPreview />;
    case "highlighter-reader":
      return <HighlighterReaderPreview />;
    case "sticky-notes":
      return <StickyNotesPreview />;
    case "kindle-highlight":
      return <KindleHighlightPreview />;
    case "editorial-brutalist":
      return <EditorialBrutalistPreview />;
    case "tabloid-splash":
      return <TabloidSplashPreview />;
    case "galaxy-brain":
      return <GalaxyBrainPreview />;
    case "risograph-zine":
      return <RisographZinePreview />;
    case "aurora-glass":
      return <AuroraGlassPreview />;
    case "bento-grid":
      return <BentoGridPreview />;
    case "swiss-poster":
      return <SwissPosterPreview />;
  }
}

/* ===========================================================
   FORMAT SPECIMENS
   Each function below is a bespoke ~280×350px mini-render of
   the format. The goal is recognisability at a glance — a
   receipt should look like a receipt, not a card.
   =========================================================== */

function EditorialBroadsheetPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#F6F2EA] p-4"
      style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
    >
      <div className="flex items-baseline justify-between border-b-2 border-[#1a1a1a] pb-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-[0.32em] text-[#1a1a1a]">
          The&nbsp;Broadsheet
        </div>
        <div className="font-mono text-[8px] uppercase text-[#922B21]">
          № 047 · vol 12
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[8px] uppercase tracking-[0.22em] text-[#922B21]">
          Weekend edition
        </div>
        <h4 className="mt-1 text-[18px] font-semibold leading-[1.02] text-[#1a1a1a]">
          The Last Honest Read of the Year
        </h4>
        <div className="mt-1 text-[8px] uppercase tracking-widest text-[#1a1a1a]/60">
          By S. Chaudhary · 12 min read
        </div>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2 border-t border-[#1a1a1a]/30 pt-2">
        <div className="text-[7.5px] leading-[1.5] text-[#1a1a1a]/85">
          <span className="float-left mr-1 text-[26px] font-bold leading-[0.82] text-[#922B21]">
            T
          </span>
          he most interesting argument I&rsquo;ve read this quarter
          doesn&rsquo;t come from a paper but a memo. The author walks
          through every objection and lands a point you can almost feel.
        </div>
        <div className="space-y-1.5 text-[7.5px] leading-[1.5] text-[#1a1a1a]/85">
          <p>
            It&rsquo;s the rare piece that gives you a vocabulary you
            didn&rsquo;t know you needed. The rest of us were guessing.
          </p>
          <p>
            The thesis itself is small. The proof is what makes it
            valuable.
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-[#1a1a1a]/30 pt-1.5 text-[7px] uppercase tracking-[0.25em] text-[#1a1a1a]/60">
        <span>Continued on p. 12</span>
        <span className="font-mono">A1</span>
      </div>
    </div>
  );
}

function MagazineCoverPreview() {
  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden bg-[#0F1115] p-5 text-white"
      style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,180,0,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-[0.32em] text-[#FFB400]">
          Readopp
        </div>
        <div className="font-mono text-[9px] text-white/60">06 · 06 · 26</div>
      </div>
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFB400]">
          Issue 04
        </div>
        <h4 className="mt-2 text-[34px] font-semibold leading-[0.9] text-white">
          How we
          <br />
          ship.
        </h4>
      </div>
      <div className="relative space-y-1">
        <div className="h-px w-12 bg-[#FFB400]" />
        <div className="text-[9px] uppercase tracking-[0.22em] text-white/70">
          Inside
        </div>
        <div className="text-[10.5px] leading-tight text-white">
          A cover for every read
        </div>
        <div className="text-[10.5px] leading-tight text-white/70">
          On taste · On patience · On working out loud
        </div>
      </div>
    </div>
  );
}

function NewYorkerFramePreview() {
  return (
    <div
      className="flex h-full flex-col bg-white p-4"
      style={{
        fontFamily: "'Adobe Caslon Pro', 'EB Garamond', Georgia, serif",
      }}
    >
      <div className="flex h-full flex-col border border-[#1a1a1a] p-3.5">
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[8px] uppercase tracking-[0.28em] text-[#9C2A1B]">
            Fiction
          </div>
          <div className="font-mono text-[8px] text-[#1a1a1a]/60">— 47 —</div>
        </div>
        <h4 className="mt-7 text-[19px] font-medium leading-[1.02] text-[#1a1a1a]">
          A Personal History of Caching
        </h4>
        <p className="mt-2 text-[8.5px] italic uppercase tracking-widest text-[#9C2A1B]">
          By S. Chaudhary
        </p>
        <div className="mt-4 text-[9px] leading-[1.55] text-[#1a1a1a]/85">
          <span className="font-semibold">Reading takes patience.</span> So
          does writing about reading. This is a small essay about a habit I
          picked up over twenty years that I&rsquo;m only now able to
          describe.
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="text-[9px] italic text-[#9C2A1B]">— continued —</div>
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#1a1a1a]/40">
            The Frame
          </div>
        </div>
      </div>
    </div>
  );
}

function TerminalBrutalistPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#0A0A0A] p-4 text-[#FAFAFA]"
      style={{
        fontFamily:
          "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
      }}
    >
      <div className="flex items-center justify-between text-[8px] text-white/50">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5F57]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#28C840]" />
        </div>
        <span>readopp ~ %</span>
      </div>
      <div className="mt-3 text-[10px] text-[#B6FF3B]">
        $ readopp --status
      </div>
      <pre className="mt-2 whitespace-pre text-[7.5px] leading-[1.2] text-white/70">
{`┌─────────────────────┐
│  panel-04           │
│  shipping orchest.  │
└─────────────────────┘`}
      </pre>
      <div className="mt-3 space-y-1 text-[9px] leading-tight">
        <div>
          <span className="text-[#B6FF3B]">→</span> agents started:{" "}
          <span className="text-white">6</span>
        </div>
        <div>
          <span className="text-[#B6FF3B]">→</span> source:{" "}
          <span className="text-white">4127 words</span>
        </div>
        <div>
          <span className="text-[#B6FF3B]">→</span> panels generated:{" "}
          <span className="text-white">6</span>
        </div>
        <div>
          <span className="text-[#B6FF3B]">→</span> elapsed:{" "}
          <span className="text-white">22.4s</span>
        </div>
      </div>
      <div className="mt-auto text-[10px] text-[#B6FF3B]">
        $ readopp deploy --prod
        <span className="ml-0.5 inline-block h-3 w-1.5 -translate-y-px bg-[#B6FF3B] align-middle motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

function EngineeringSpecPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#FAFAFA] p-4 text-[#0A0A0A]"
      style={{
        fontFamily: "ui-sans-serif, system-ui, 'Inter', sans-serif",
      }}
    >
      <div className="flex items-baseline justify-between border-b border-[#0A0A0A]/15 pb-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#0A0A0A]/60">
          RFC-014
        </div>
        <div className="inline-flex items-center gap-1 rounded-sm bg-[#2962FF]/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-[#2962FF]">
          ● Draft
        </div>
      </div>
      <h4 className="mt-3 text-[16px] font-semibold leading-tight text-[#0A0A0A]">
        Stream Resumption
      </h4>
      <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#0A0A0A]/60">
        Author: S. Chaudhary · 2026-06-06
      </div>
      <div className="mt-3 space-y-2 text-[9px] leading-[1.55] text-[#0A0A0A]/85">
        <div>
          <span className="font-semibold text-[#0A0A0A]">1.1 Goals</span>
          <div className="ml-2 mt-0.5 text-[8.5px] text-[#0A0A0A]/70">
            Allow long generations to resume after a dropped SSE connection
            without re-running upstream agents.
          </div>
        </div>
        <div>
          <span className="font-semibold text-[#0A0A0A]">1.2 Non-goals</span>
          <div className="ml-2 mt-0.5 text-[8.5px] text-[#0A0A0A]/70">
            Persisting renders across deployments. Cross-region failover.
          </div>
        </div>
        <div>
          <span className="font-semibold text-[#0A0A0A]">2 · Approach</span>
          <div className="ml-2 mt-0.5 text-[8.5px] text-[#0A0A0A]/70">
            Each job state is journalled to Supabase; a resumed connection
            streams the journal&hellip;
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[#0A0A0A]/10 pt-2 text-[8px] font-mono uppercase tracking-widest text-[#0A0A0A]/40">
        <span>readopp / rfc-014</span>
        <span>page 1 / 4</span>
      </div>
    </div>
  );
}

function NotebookCellPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#FAFAFA] p-3 text-[#1A1A1A]"
      style={{
        fontFamily: "ui-monospace, 'IBM Plex Mono', SFMono-Regular, monospace",
      }}
    >
      <div className="flex items-center justify-between text-[8px] text-[#1A1A1A]/60">
        <span>training_loop.ipynb</span>
        <span className="rounded-sm bg-[#0066CC]/10 px-1 py-0.5 text-[#0066CC]">
          Python 3.13
        </span>
      </div>

      <div className="mt-3 rounded-md border border-[#0066CC]/30 bg-white p-2 text-[8.5px]">
        <div className="mb-1 text-[#0066CC]">In [04]:</div>
        <pre className="whitespace-pre-wrap text-[#1A1A1A]/90">
{`from readopp import explain
out = explain(url, agents=6)
out.preview()`}
        </pre>
      </div>

      <div className="mt-2 rounded-md border border-[#1A1A1A]/10 bg-white p-2 text-[8.5px]">
        <div className="mb-1 text-[#1A1A1A]/60">Out[04]:</div>
        <div className="text-[#1A1A1A]/80">
          → completed in <span className="font-semibold">12.4s</span>
        </div>
        <div className="mt-1 text-[#1A1A1A]/70">
          panels: <span className="text-[#0066CC]">6</span> · words read:{" "}
          <span className="text-[#0066CC]">4127</span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-[#0066CC]/10">
          <div className="h-full w-4/5 bg-[#0066CC]" />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 text-[7.5px] text-[#1A1A1A]/40">
        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
        <span>kernel idle</span>
        <span className="ml-auto">cell 4 of 12</span>
      </div>
    </div>
  );
}

function ReceiptPreview() {
  return (
    <div className="relative h-full overflow-hidden bg-[#0A0A0A] p-2">
      {/* Thermal-paper receipt body */}
      <div
        className="relative h-full overflow-hidden bg-[#FBF7EE] px-4 pb-3 pt-4 text-[#1A1A1A]"
        style={{
          fontFamily:
            "ui-monospace, 'IBM Plex Mono', SFMono-Regular, monospace",
          // Jagged top edge — torn-receipt vibe.
          clipPath:
            "polygon(0 4px, 5% 0, 10% 4px, 15% 0, 20% 4px, 25% 0, 30% 4px, 35% 0, 40% 4px, 45% 0, 50% 4px, 55% 0, 60% 4px, 65% 0, 70% 4px, 75% 0, 80% 4px, 85% 0, 90% 4px, 95% 0, 100% 4px, 100% 100%, 0 100%)",
        }}
      >
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em]">
            Readopp Café
          </div>
          <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/70">
            127 Carousel Lane · WFH
          </div>
        </div>

        <div className="my-2 text-center text-[8px] text-[#1A1A1A]/60">
          - - - - - - - - - - - - - - -
        </div>

        <div className="text-[8px] font-semibold uppercase tracking-widest text-[#1A1A1A]/80">
          Receipt // attention spent
        </div>
        <div className="mt-0.5 text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
          No. 047 · 06.06.26 · 09:42
        </div>

        <div className="mt-3 space-y-1 text-[8px]">
          <div className="flex justify-between">
            <span>Reading · 4127 words</span>
            <span>10:00</span>
          </div>
          <div className="flex justify-between">
            <span>Outlining · 6 panels</span>
            <span>02:14</span>
          </div>
          <div className="flex justify-between">
            <span>Captioning</span>
            <span>00:46</span>
          </div>
          <div className="flex justify-between">
            <span>Export · PNG ×6</span>
            <span>00:08</span>
          </div>
        </div>

        <div className="my-2 text-[8px] text-[#1A1A1A]/60">
          - - - - - - - - - - - - - - -
        </div>

        <div className="flex justify-between text-[10px] font-bold">
          <span>TOTAL</span>
          <span className="text-[#C0392B]">13:08</span>
        </div>

        <div className="mt-3 text-center">
          <div className="mx-auto flex h-5 w-32 items-end justify-center gap-[1px]">
            {[
              2, 4, 1, 5, 3, 2, 4, 5, 1, 3, 4, 2, 5, 1, 3, 2, 4, 5, 2, 1, 4,
              3, 5, 2, 1, 4, 3, 5, 2, 4,
            ].map((h, i) => (
              <div
                key={i}
                className="bg-[#1A1A1A]"
                style={{ width: 1, height: h * 3 }}
              />
            ))}
          </div>
          <div className="mt-0.5 font-mono text-[7px] tracking-widest text-[#1A1A1A]/60">
            047 0606 2226
          </div>
        </div>

        <div className="mt-1 text-center text-[7px] uppercase tracking-widest text-[#1A1A1A]/50">
          Thank you for reading.
        </div>
      </div>
    </div>
  );
}

function IndexCardPreview() {
  return (
    <div className="relative h-full overflow-hidden bg-[#FFFEF7] p-4 text-[#1A1A1A]">
      {/* Red left margin line, like a real index card */}
      <div className="absolute left-7 top-0 h-full w-px bg-[#C0392B]/60" />

      {/* Ruled blue horizontal lines */}
      <div className="absolute inset-0 px-0 pt-12">
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="mt-[18px] h-px w-full bg-[#0033A0]/15"
          />
        ))}
      </div>

      {/* Card content */}
      <div className="relative pl-8">
        <div
          className="text-[14px] leading-[18px]"
          style={{
            fontFamily:
              "'iA Writer Quattro', 'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#C0392B]/80">
            № 047
          </div>
          <div className="mt-1 text-[13px] font-semibold">
            on focused reading
          </div>
        </div>

        <div
          className="mt-2 space-y-[3px] text-[10px] leading-[18px] text-[#1A1A1A]/80"
          style={{
            fontFamily:
              "'iA Writer Quattro', 'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <div>The harder the read, the longer</div>
          <div>I take to admit it&rsquo;s worth it.</div>
          <div>What I want is not summary —</div>
          <div>I want the writer&rsquo;s posture.</div>
          <div>The line I can take into the day.</div>
          <div>&nbsp;</div>
          <div className="font-mono text-[8.5px] text-[#1A1A1A]/60">
            see also: №012 · №031
          </div>
        </div>
      </div>

      {/* Corner clip */}
      <div className="absolute right-2 top-2 h-3 w-3 rotate-45 border-r border-t border-[#1A1A1A]/15" />
    </div>
  );
}

function BoardingPassPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#F4F1EA] p-3 text-[#1A1A1A]"
      style={{
        fontFamily: "ui-sans-serif, system-ui, 'Inter', sans-serif",
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-t-md bg-[#0033A0] px-3 py-1.5 text-white">
        <div className="text-[9px] font-semibold uppercase tracking-[0.28em]">
          Readopp Air
        </div>
        <div className="font-mono text-[9px]">RP 1480</div>
      </div>

      <div className="flex flex-1 rounded-b-md bg-white">
        {/* Main pass */}
        <div className="flex-1 p-3">
          <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
            Passenger
          </div>
          <div className="text-[11px] font-semibold">CHAUDHARY / S</div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
                From
              </div>
              <div className="text-[18px] font-bold leading-none">RDG</div>
              <div className="text-[8px] text-[#1A1A1A]/70">Reading List</div>
            </div>
            <div>
              <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
                To
              </div>
              <div className="text-[18px] font-bold leading-none">PST</div>
              <div className="text-[8px] text-[#1A1A1A]/70">Posted Feed</div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1">
            <div>
              <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
                Gate
              </div>
              <div className="text-[12px] font-semibold">04</div>
            </div>
            <div>
              <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
                Seat
              </div>
              <div className="text-[12px] font-semibold">12A</div>
            </div>
            <div>
              <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
                Boards
              </div>
              <div className="text-[12px] font-semibold">08:15</div>
            </div>
          </div>
        </div>

        {/* Perforated divider */}
        <div className="my-3 w-px border-l-2 border-dashed border-[#1A1A1A]/20" />

        {/* Tear-off stub */}
        <div className="flex w-16 flex-col items-center justify-between p-2">
          <div className="text-center">
            <div className="text-[7px] uppercase tracking-widest text-[#1A1A1A]/60">
              Seat
            </div>
            <div className="text-[14px] font-bold">12A</div>
          </div>
          <div
            className="flex h-12 items-end gap-px"
            aria-hidden
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#1A1A1A]"
                style={{
                  width: i % 3 === 0 ? 2 : 1,
                  height: 28 + ((i * 3) % 10),
                }}
              />
            ))}
          </div>
          <div className="font-mono text-[7px] text-[#1A1A1A]/60">
            06 JUN
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlighterReaderPreview() {
  return (
    <div
      className="relative flex h-full flex-col bg-[#FFFCEB] p-4 text-[#1A1A1A]"
      style={{ fontFamily: "ui-serif, 'IBM Plex Serif', Georgia, serif" }}
    >
      {/* Folded page corner */}
      <div
        className="absolute right-0 top-0 h-6 w-6 bg-[#1A1A1A]/5"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
      />
      <div
        className="absolute right-0 top-0 h-6 w-6"
        style={{
          background:
            "linear-gradient(225deg, transparent 50%, rgba(0,0,0,0.08) 50%)",
        }}
      />

      <div className="font-mono text-[8px] uppercase tracking-widest text-[#1A1A1A]/50">
        page 03 · annotated
      </div>
      <h4 className="mt-2 text-[16px] font-semibold leading-snug">
        Three ideas worth highlighting
      </h4>

      <div className="mt-3 space-y-2 text-[9.5px] leading-[1.6] text-[#1A1A1A]/85">
        <p>
          Most arguments don&rsquo;t need more evidence; they need better{" "}
          <mark className="bg-[#FFE066] px-0.5 text-[#1A1A1A]">
            sequencing
          </mark>
          . If the reader sees A then B then C, you don&rsquo;t need to
          shout.
        </p>
        <p className="text-[#1A1A1A]/70">
          The discipline isn&rsquo;t holding back — it&rsquo;s knowing
          which paragraph the&hellip;
        </p>
        <p>
          <mark className="bg-[#FFE066] px-0.5 text-[#1A1A1A]">
            Patience compounds.
          </mark>{" "}
          A reader who is willing to wait one extra paragraph will trust
          you on the next.
        </p>
      </div>

      <div className="mt-auto -ml-2 flex items-center gap-2 pl-2">
        <span
          className="text-[#C0392B]"
          style={{
            fontFamily: "'Caveat', 'Reenie Beanie', cursive",
            fontSize: 16,
          }}
        >
          ← worth re-reading
        </span>
      </div>
    </div>
  );
}

function StickyNotesPreview() {
  return (
    <div className="relative h-full overflow-hidden bg-[#FAFAFA] p-4">
      {/* Sticky 1 — slightly rotated, behind */}
      <div
        className="absolute left-5 top-7 h-32 w-44 -rotate-2 bg-[#FFE066] p-3 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.25)]"
        style={{
          fontFamily: "'Caveat', 'Reenie Beanie', 'Bradley Hand', cursive",
        }}
      >
        <div className="text-[18px] font-semibold leading-tight text-[#1F1F1F]">
          stickies for what mattered
        </div>
        <div className="mt-1 text-[13px] leading-tight text-[#1F1F1F]/85">
          sequencing &gt; volume
        </div>
        <div className="mt-1 text-[13px] leading-tight text-[#1F1F1F]/85">
          patience compounds
        </div>
      </div>

      {/* Sticky 2 — front, slight other rotation */}
      <div
        className="absolute right-3 bottom-3 h-28 w-40 rotate-3 bg-[#FFB347] p-3 shadow-[0_10px_22px_-10px_rgba(0,0,0,0.32)]"
        style={{
          fontFamily: "'Caveat', 'Reenie Beanie', 'Bradley Hand', cursive",
        }}
      >
        <div className="text-[15px] leading-tight text-[#1F1F1F]">
          save this one
        </div>
        <div className="text-[15px] leading-tight text-[#1F1F1F]">
          for <span className="underline decoration-2">monday</span>
        </div>
        <div className="mt-3 text-[11px] text-[#1F1F1F]/70">
          – S.C.
        </div>
      </div>
    </div>
  );
}

function KindleHighlightPreview() {
  return (
    <div
      className="flex h-full flex-col bg-[#F8F5EE] p-3 text-[#1A1A1A]"
      style={{
        fontFamily:
          "ui-serif, 'Bookerly', 'IBM Plex Serif', Georgia, serif",
      }}
    >
      {/* E-reader status bar */}
      <div className="flex items-center justify-between border-b border-[#1A1A1A]/15 pb-1 font-sans text-[8px] uppercase tracking-widest text-[#1A1A1A]/60">
        <span>The Honest Read</span>
        <span>67%</span>
      </div>

      <div className="mt-3 flex-1 text-[10px] leading-[1.65] text-[#1A1A1A]/90">
        <p>
          The question isn&rsquo;t whether you read enough. It&rsquo;s
          whether you stay with what you read long enough to remember it
          tomorrow.
        </p>
        <p className="mt-2 rounded-[2px] bg-[#7A6650]/12 px-1 py-0.5">
          The discipline of careful reading is the same as the discipline
          of careful writing: refusing to be hurried by anyone who
          isn&rsquo;t the work.
        </p>
        <p className="mt-2 text-[#1A1A1A]/70">
          The note you write to yourself is the proof the reading
          happened.
        </p>
      </div>

      {/* Margin note */}
      <div className="mt-2 border-t border-[#1A1A1A]/12 pt-2">
        <div className="font-sans text-[7.5px] uppercase tracking-widest text-[#7A6650]">
          Location 1820 · highlight
        </div>
        <div
          className="mt-1 text-[11px] text-[#1A1A1A]/85"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          Note: came back to this twice.
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="mt-2 flex items-center justify-between font-sans text-[7px] uppercase tracking-widest text-[#1A1A1A]/40">
        <span>Loc 1812 of 2701</span>
        <span>14 min left in chapter</span>
      </div>
    </div>
  );
}

function EditorialBrutalistPreview() {
  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden bg-[#FFEB00] p-4 text-[#0A0A0A]"
      style={{
        fontFamily:
          "'Druk Wide', 'PP Editorial New', 'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[9px] uppercase tracking-[0.28em]">
          01 / hot take
        </div>
        <div className="h-2 w-2 bg-[#0A0A0A]" />
      </div>

      <div className="text-[34px] font-black leading-[0.88] tracking-[-0.02em]">
        STOP.
        <br />
        THINK.
        <br />
        SHIP.
      </div>

      <div className="flex items-end justify-between">
        <div className="max-w-[55%] text-[8.5px] uppercase tracking-widest">
          Three verbs for the writer who refuses
          <br />
          to draft in public.
        </div>
        <div className="font-mono text-[10px] font-bold">RDP</div>
      </div>

      {/* Decorative scale ruler */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center gap-[2px]">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#0A0A0A]"
            style={{ width: 1, height: i % 5 === 0 ? 6 : 3 }}
          />
        ))}
      </div>
    </div>
  );
}

function TabloidSplashPreview() {
  return (
    <div
      className="relative flex h-full flex-col bg-[#E03131] p-3 text-white"
      style={{
        fontFamily:
          "'Knockout', 'Champion Gothic', 'Helvetica Neue', sans-serif",
      }}
    >
      <div className="flex items-baseline justify-between border-b-2 border-white pb-1">
        <div className="text-[14px] font-black uppercase italic tracking-tight">
          The Daily Readopp
        </div>
        <div className="font-mono text-[8px]">Sat · 06.06</div>
      </div>

      <div className="my-2 inline-flex w-fit items-center bg-[#FFD500] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#0A0A0A]">
        ★ Exclusive
      </div>

      <div className="text-[26px] font-black uppercase italic leading-[0.85] tracking-tight">
        SHOCK!
        <br />
        AGENT
        <br />
        FORGETS
        <br />
        CONTEXT
      </div>

      <div className="mt-auto border-t-2 border-white/70 pt-2">
        <div className="text-[8.5px] font-bold uppercase tracking-widest">
          &ldquo;It happened mid-paragraph,&rdquo; sources say
        </div>
        <div className="mt-1 flex items-baseline justify-between text-[8px] uppercase">
          <span className="text-white/85">Full story &middot; page 2</span>
          <span className="text-[#FFD500]">95p</span>
        </div>
      </div>
    </div>
  );
}

function GalaxyBrainPreview() {
  // Sparkle positions hand-placed for the small preview frame so the
  // cosmic field reads without overwhelming the brain. The actual
  // template uses a wider seeded distribution at export size.
  const sparkles: Array<[number, number, number, number]> = [
    [10, 16, 5, 0.85],
    [18, 78, 4, 0.75],
    [88, 14, 5, 0.85],
    [82, 70, 4, 0.7],
    [56, 8, 4, 0.8],
    [62, 88, 5, 0.8],
    [40, 32, 3, 0.55],
    [72, 38, 3, 0.55],
  ];
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden p-4 text-white"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 50%, #6047C8 0%, #1A1438 60%, #050020 100%)",
        fontFamily:
          "'Söhne', 'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Cosmic sparkles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {sparkles.map(([x, y, size, op], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: "#C8B3FF",
              opacity: op,
              boxShadow:
                "0 0 8px rgba(200,179,255,0.85), 0 0 16px rgba(200,179,255,0.55)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      {/* Top — tier badge + counter */}
      <div className="relative flex items-baseline justify-between font-mono text-[8px] uppercase tracking-[0.28em] text-[#C8B3FF]">
        <span>
          Tier 04
          <span className="ml-2 font-bold tracking-[0.18em] text-white">
            Cosmic
          </span>
        </span>
        <span className="text-white/60">03 / 06</span>
      </div>

      {/* Big brain emoji with cosmic halo */}
      <div className="relative flex flex-1 items-center justify-center">
        <div
          className="text-[105px] leading-none"
          style={{
            filter:
              "drop-shadow(0 0 14px rgba(200,179,255,0.75)) drop-shadow(0 0 30px rgba(200,179,255,0.55)) drop-shadow(0 0 56px rgba(200,179,255,0.42))",
          }}
        >
          🧠
        </div>
      </div>

      {/* Headline */}
      <h4
        className="relative text-center text-[15px] font-extrabold leading-tight"
        style={{ textShadow: "0 1px 18px rgba(200,179,255,0.65)" }}
      >
        Reading the source paper.
      </h4>
      <p className="relative mt-1 text-center text-[8.5px] text-white/85">
        For when the headline isn&rsquo;t enough.
      </p>

      {/* Footer: brain power gauge */}
      <div className="relative mt-3 flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.24em] text-white/60">
        <span>brain power</span>
        <span className="flex items-center gap-[3px]">
          {[true, true, true, true, false].map((lit, i) => (
            <span
              key={i}
              className="h-[6px] w-[12px] rounded-[1px]"
              style={{
                background: lit ? "#C8B3FF" : "rgba(255,255,255,0.12)",
                boxShadow: lit
                  ? "0 0 6px rgba(200,179,255,0.75)"
                  : "none",
              }}
            />
          ))}
        </span>
        <span>readopp.com</span>
      </div>
    </div>
  );
}

function RisographZinePreview() {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#FFFCEB] p-4 text-[#1A1A1A]"
      style={{
        fontFamily: "ui-serif, 'Reckless', 'Tiempos Headline', Georgia, serif",
      }}
    >
      {/* Riso misregistration: a slightly offset pink ink shape */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-2 top-12 h-28 w-28 rounded-full mix-blend-multiply"
        style={{ background: "rgba(255,72,176,0.45)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 top-10 h-24 w-24 rounded-full mix-blend-multiply"
        style={{ background: "rgba(72,138,255,0.4)" }}
      />

      <div className="relative font-mono text-[8px] uppercase tracking-[0.28em] text-[#FF48B0]">
        fig. 04 · pink / blue
      </div>

      <h4 className="relative mt-2 text-[18px] font-semibold leading-tight text-[#1A1A1A]">
        small studies in
        <br />
        design taste
      </h4>

      <div className="relative mt-auto space-y-1 text-[9px] leading-snug text-[#1A1A1A]/85">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#1A1A1A]/60">
          contents
        </div>
        <div>01 · the discipline of the small page</div>
        <div>02 · against the gradient</div>
        <div>03 · what the riso teaches the screen</div>
      </div>

      <div className="relative mt-3 flex items-baseline justify-between font-mono text-[7.5px] uppercase tracking-widest text-[#1A1A1A]/50">
        <span>readopp press</span>
        <span>vol. 04 · 2026</span>
      </div>
    </div>
  );
}

function AuroraGlassPreview() {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#07090F] p-4"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Aurora blooms */}
      <div
        className="pointer-events-none absolute -inset-1/4"
        style={{
          background:
            "radial-gradient(40% 34% at 18% 10%, rgba(79,70,229,0.5), transparent 70%), radial-gradient(44% 38% at 88% 30%, rgba(6,182,212,0.38), transparent 70%), radial-gradient(50% 42% at 60% 105%, rgba(79,70,229,0.28), transparent 72%)",
          filter: "blur(28px)",
        }}
      />
      <div className="relative flex items-center justify-between text-[7px] font-semibold uppercase tracking-[0.22em] text-white/50">
        <span>Readopp</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/75">
          02 / 05
        </span>
      </div>
      <div
        className="relative mt-3 text-[15px] font-bold leading-[1.08] tracking-tight"
        style={{
          background:
            "linear-gradient(92deg, #F8FAFC 0%, #A5B4FC 55%, #67E8F9 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Ship the launch deck.
      </div>
      <div className="relative mt-3 flex flex-1 items-center justify-center rounded-2xl border border-white/15 bg-[#FAFBFD]/95 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        <div className="w-full space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-5 flex-1 rounded bg-[#E6F1FB]" />
            <div className="h-5 w-8 rounded bg-[#1F97DC]/80" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 flex-[1.6] rounded bg-[#E1F5EE]" />
            <div className="h-5 w-5 rounded bg-[#EEEDFE]" />
          </div>
          <div className="h-1.5 w-3/4 rounded bg-[#1a1a1a]/15" />
          <div className="h-1.5 w-1/2 rounded bg-[#1a1a1a]/10" />
        </div>
      </div>
      <div className="relative mt-3 border-t border-white/10 pt-1.5 text-[6.5px] uppercase tracking-[0.16em] text-white/40">
        <span>arxiv.org · readopp.com</span>
      </div>
    </div>
  );
}

function BentoGridPreview() {
  return (
    <div
      className="flex h-full flex-col gap-1.5 bg-[#F5F5F7] p-3"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex gap-1.5">
        <div className="flex-1 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.05)]">
          <div className="text-[6px] font-semibold uppercase tracking-[0.18em] text-[#0A84FF]">
            Readopp
          </div>
          <div className="mt-1 text-[12px] font-bold leading-[1.08] tracking-tight text-[#1D1D1F]">
            Everything in its tile.
          </div>
        </div>
        <div className="flex w-12 flex-col items-center justify-center rounded-xl bg-[#0A84FF] text-white shadow-[0_6px_18px_rgba(10,132,255,0.3)]">
          <span className="text-[16px] font-bold leading-none tracking-tight">
            03
          </span>
          <span className="mt-0.5 text-[5px] font-semibold tracking-[0.12em] opacity-75">
            OF 05
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.05)]">
        <div className="flex w-full items-end justify-around gap-1.5 px-2">
          <div className="w-5 rounded-t bg-[#E3F0FF]" style={{ height: 22 }} />
          <div className="w-5 rounded-t bg-[#0A84FF]/70" style={{ height: 38 }} />
          <div className="w-5 rounded-t bg-[#E3F0FF]" style={{ height: 30 }} />
          <div className="w-5 rounded-t bg-[#0A84FF]" style={{ height: 52 }} />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="flex-[2] rounded-xl bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.05)]">
          <div className="h-1 w-5/6 rounded bg-[#1D1D1F]/15" />
          <div className="mt-1 h-1 w-3/5 rounded bg-[#1D1D1F]/10" />
        </div>
        <div className="flex-1 rounded-xl bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.05)]">
          <div className="text-[5px] font-semibold uppercase tracking-[0.16em] text-[#515154]">
            Source
          </div>
          <div className="mt-0.5 text-[6.5px] font-semibold text-[#1D1D1F]">
            stripe.com
          </div>
        </div>
      </div>
    </div>
  );
}

function SwissPosterPreview() {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#F4F2ED] p-4"
      style={{
        fontFamily: "Helvetica, 'Inter', Arial, sans-serif",
      }}
    >
      {/* Modular grid columns */}
      <div
        className="pointer-events-none absolute inset-4"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(17,17,17,0.12) 1px, transparent 1px)",
          backgroundSize: "25% 100%",
        }}
      />
      <div className="relative flex items-baseline justify-between text-[7px] font-medium text-[#111111]">
        <span>readopp — essay</span>
        <span className="font-bold text-[#E63312]">2/5</span>
      </div>
      <div className="relative flex flex-1 items-center justify-end pr-3">
        <div
          className="bg-[#E63312]"
          style={{ width: 64, height: 64, borderRadius: "0 100% 0 0" }}
        />
      </div>
      <div className="relative text-[19px] font-bold lowercase leading-[0.98] tracking-[-0.045em] text-[#111111]">
        grid above all.
      </div>
      <div className="relative mt-2 max-w-[80%] text-[7px] leading-[1.45] text-[#111111]/80">
        One geometric accent per panel. Flat color, strict columns, lowercase
        grotesk — the poster does the talking.
      </div>
      <div className="relative mt-3 flex justify-between border-t-2 border-[#111111] pt-1.5 text-[6.5px] font-medium text-[#111111]">
        <span>zeitschrift.ch</span>
        <span>readopp.com</span>
      </div>
    </div>
  );
}
