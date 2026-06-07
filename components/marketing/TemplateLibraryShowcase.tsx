"use client";

import Link from "next/link";
import { MouseEvent, useEffect, useRef, useState } from "react";

/**
 * Modern marquee-style template showcase. One row per category, each
 * drifting horizontally on a continuous loop in alternating directions.
 * On row hover the drift pauses so the user can read; on card hover the
 * card lifts with a perspective tilt and an accent-colored spotlight
 * tracks the cursor. The row's entrance is a single blur-spring reveal
 * once it enters the viewport — quieter than the per-card stagger we
 * had before, and gives the impression the rows were always alive.
 *
 * Keyframes + reduced-motion override live in app/globals.css so the
 * animation can be retargeted from CSS without re-rendering React.
 */

interface TemplatePreview {
  id: string;
  name: string;
  tagline: string;
  preview: {
    background: string;
    foreground: string;
    accent: string;
    sampleHeading: string;
    sampleNote: string;
    fontFamily: string;
  };
}

interface CategoryRowData {
  name: string;
  caption: string;
  templates: TemplatePreview[];
}

const ROWS: CategoryRowData[] = [
  {
    name: "Editorial",
    caption: "Magazine-page seriousness for longform writers.",
    templates: [
      {
        id: "editorial-broadsheet",
        name: "Editorial Broadsheet",
        tagline: "FT Weekend grid with drop caps.",
        preview: {
          background: "#F6F2EA",
          foreground: "#1A1A1A",
          accent: "#922B21",
          sampleHeading: "The Last Honest Read of the Year",
          sampleNote: "Notes from a careful analyst",
          fontFamily:
            "ui-serif, 'Tiempos Headline', Georgia, 'Times New Roman', serif",
        },
      },
      {
        id: "magazine-cover",
        name: "Magazine Cover",
        tagline: "Full-bleed display serif.",
        preview: {
          background: "#0F1115",
          foreground: "#FFFFFF",
          accent: "#FFB400",
          sampleHeading: "ISSUE 04 — How we ship.",
          sampleNote: "A cover for every read.",
          fontFamily:
            "ui-serif, 'Tiempos Headline', Georgia, 'Times New Roman', serif",
        },
      },
      {
        id: "new-yorker-frame",
        name: "New Yorker Frame",
        tagline: "Thin border, Caslon, magazine page.",
        preview: {
          background: "#FFFFFF",
          foreground: "#1A1A1A",
          accent: "#9C2A1B",
          sampleHeading: "A Personal History of Caching",
          sampleNote: "Reading takes patience.",
          fontFamily: "'Adobe Caslon Pro', 'EB Garamond', Georgia, serif",
        },
      },
    ],
  },
  {
    name: "Technical",
    caption: "For founders and engineers who think in monospace.",
    templates: [
      {
        id: "terminal-brutalist",
        name: "Terminal Brutalist",
        tagline: "Monospace, ASCII rules, neon accent.",
        preview: {
          background: "#0A0A0A",
          foreground: "#FAFAFA",
          accent: "#B6FF3B",
          sampleHeading: "panel-04: shipping the orchestrator",
          sampleNote: "$ readopp deploy --prod",
          fontFamily:
            "ui-monospace, 'JetBrains Mono', SFMono-Regular, monospace",
        },
      },
      {
        id: "engineering-spec",
        name: "Engineering Spec",
        tagline: "RFC-style design doc.",
        preview: {
          background: "#FAFAFA",
          foreground: "#0A0A0A",
          accent: "#2962FF",
          sampleHeading: "RFC-014: Stream Resumption",
          sampleNote: "Status: DRAFT · Date: 2026-06",
          fontFamily: "ui-sans-serif, system-ui, 'Inter', sans-serif",
        },
      },
      {
        id: "notebook-cell",
        name: "Notebook Cell",
        tagline: "Jupyter input/output cell.",
        preview: {
          background: "#FAFAFA",
          foreground: "#1A1A1A",
          accent: "#0066CC",
          sampleHeading: "In [04]: training_loop.run()",
          sampleNote: "Out[04]: → completed in 12.4s",
          fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
        },
      },
    ],
  },
  {
    name: "Document",
    caption: "Borrow trust from familiar paper forms.",
    templates: [
      {
        id: "receipt",
        name: "Receipt",
        tagline: "Thermal-paper receipt with barcode.",
        preview: {
          background: "#FBF7EE",
          foreground: "#1A1A1A",
          accent: "#C0392B",
          sampleHeading: "RECEIPT // ATTENTION SPENT",
          sampleNote: "NO. 047 · 06.06.26",
          fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
        },
      },
      {
        id: "index-card",
        name: "Index Card",
        tagline: "Ruled Zettelkasten card.",
        preview: {
          background: "#FFFEF7",
          foreground: "#1A1A1A",
          accent: "#C0392B",
          sampleHeading: "047 / on focused reading",
          sampleNote: "see also: №012 · №031",
          fontFamily: "'iA Writer Quattro', 'IBM Plex Sans', sans-serif",
        },
      },
      {
        id: "boarding-pass",
        name: "Boarding Pass",
        tagline: "Airline ticket with tear-off stub.",
        preview: {
          background: "#F4F1EA",
          foreground: "#1A1A1A",
          accent: "#0033A0",
          sampleHeading: "Gate 04 · Seat 12A",
          sampleNote: "RP 1480 · 06 JUN · boarding 08:15",
          fontFamily: "ui-sans-serif, 'Inter', system-ui, sans-serif",
        },
      },
    ],
  },
  {
    name: "Reader",
    caption: "For people who post what they're reading.",
    templates: [
      {
        id: "highlighter-reader",
        name: "Highlighter Reader",
        tagline: "Marked-up PDF excerpt.",
        preview: {
          background: "#FFFCEB",
          foreground: "#1A1A1A",
          accent: "#FFE066",
          sampleHeading: "Three ideas worth highlighting",
          sampleNote: "← worth re-reading",
          fontFamily: "ui-serif, 'IBM Plex Serif', Georgia, serif",
        },
      },
      {
        id: "sticky-notes",
        name: "Sticky Notes",
        tagline: "Overlapped Post-it notes.",
        preview: {
          background: "#FAFAFA",
          foreground: "#1F1F1F",
          accent: "#FFE066",
          sampleHeading: "stickies for what mattered",
          sampleNote: "save this one for monday",
          fontFamily: "'Caveat', 'Reenie Beanie', cursive",
        },
      },
      {
        id: "kindle-highlight",
        name: "Kindle Highlight",
        tagline: "E-reader page with location markers.",
        preview: {
          background: "#F8F5EE",
          foreground: "#1A1A1A",
          accent: "#7A6650",
          sampleHeading: "Location 1820 · highlighted",
          sampleNote: "Note: came back to this twice.",
          fontFamily:
            "ui-serif, 'Bookerly', 'IBM Plex Serif', Georgia, serif",
        },
      },
    ],
  },
  {
    name: "Bold",
    caption: "For loud opinions that earn their space on the feed.",
    templates: [
      {
        id: "editorial-brutalist",
        name: "Editorial Brutalist",
        tagline: "Pentagram-scale type.",
        preview: {
          background: "#FFEB00",
          foreground: "#0A0A0A",
          accent: "#0A0A0A",
          sampleHeading: "STOP. THINK. SHIP.",
          sampleNote: "01 / hot take",
          fontFamily:
            "'Druk Wide', 'PP Editorial New', 'Inter', sans-serif",
        },
      },
      {
        id: "tabloid-splash",
        name: "Tabloid Splash",
        tagline: "Tabloid front-page energy.",
        preview: {
          background: "#E03131",
          foreground: "#FFFFFF",
          accent: "#FFD500",
          sampleHeading: "SHOCK! AGENT FORGETS CONTEXT.",
          sampleNote: "Exclusive · page 2",
          fontFamily:
            "'Knockout', 'Champion Gothic', 'Inter', sans-serif",
        },
      },
      {
        id: "risograph-zine",
        name: "Risograph Zine",
        tagline: "Two-color riso with misregistration.",
        preview: {
          background: "#FFFCEB",
          foreground: "#1A1A1A",
          accent: "#FF48B0",
          sampleHeading: "small studies in design taste",
          sampleNote: "fig. 04 · pink/blue",
          fontFamily:
            "ui-serif, 'Reckless', 'Tiempos Headline', Georgia, serif",
        },
      },
    ],
  },
];

export function TemplateLibraryShowcase() {
  return (
    <div className="mt-16 sm:mt-20">
      <div className="space-y-14 sm:space-y-20">
        {ROWS.map((row, i) => (
          <CategoryRow key={row.name} row={row} reverse={i % 2 === 1} />
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <Link
          href="#try"
          className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
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
    </div>
  );
}

function CategoryRow({
  row,
  reverse,
}: {
  row: CategoryRowData;
  reverse: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    // Single-shot reveal — once the row crosses the viewport threshold,
    // we lock it in so the cards don't re-blur on scroll-up.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The marquee loop relies on rendering the cards twice and translating
  // by -50%, so the second copy lands exactly where the first started.
  const loopCards = [...row.templates, ...row.templates];

  return (
    <section ref={rowRef}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1">
        <div className="flex items-baseline gap-3">
          <h4 className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
            {row.name}
          </h4>
          <p className="text-sm text-ink-soft sm:text-base">{row.caption}</p>
        </div>
        <span className="font-mono text-[11px] text-ink-faint">
          {row.templates.length} templates
        </span>
      </div>

      {/* Mask-fade edges keep the marquee from butting hard against the
          section boundaries. The negative margin lets cards bleed past
          the container's horizontal padding on mobile, then we mask the
          first and last few percent. */}
      <div
        className="relative -mx-6 overflow-hidden sm:-mx-2"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%)",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="readopp-marquee-track flex gap-5 will-change-transform"
          data-paused={paused ? "true" : "false"}
          style={{
            width: "max-content",
            opacity: revealed ? 1 : 0,
            filter: revealed ? "blur(0)" : "blur(12px)",
            transform: revealed ? "translateY(0)" : "translateY(24px)",
            transition:
              "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1), filter 1000ms cubic-bezier(0.16, 1, 0.3, 1), transform 1000ms cubic-bezier(0.16, 1, 0.3, 1)",
            animation: revealed
              ? `${reverse ? "readopp-marquee-rev" : "readopp-marquee-fwd"} 48s linear infinite`
              : "none",
          }}
        >
          {loopCards.map((t, i) => (
            <TemplateCard key={`${t.id}-${i}`} template={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ template }: { template: TemplatePreview }) {
  const cardRef = useRef<HTMLElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // ±6deg perspective tilt — pronounced enough to feel alive without
    // veering into Stripe-card territory.
    const rx = (0.5 - y) * 6;
    const ry = (x - 0.5) * 6;
    card.style.setProperty("--rx", `${rx}deg`);
    card.style.setProperty("--ry", `${ry}deg`);
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
  }

  function reset() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  }

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      className="group/card relative w-[300px] shrink-0 overflow-hidden rounded-2xl border border-paper-line bg-white shadow-[0_1px_3px_rgba(15,17,21,0.04)] transition-shadow duration-500 hover:shadow-[0_30px_60px_-25px_rgba(15,17,21,0.28)] sm:w-[320px]"
      style={{
        transform:
          "perspective(1100px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
        transformStyle: "preserve-3d",
        transition:
          "transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 500ms ease",
      }}
    >
      <div
        className="relative h-[230px] overflow-hidden p-5"
        style={{
          background: template.preview.background,
          color: template.preview.foreground,
          fontFamily: template.preview.fontFamily,
        }}
      >
        {/* Cursor-tracked accent spotlight — fades in on hover, follows
            the mouse via CSS vars set in handleMouseMove. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-400 group-hover/card:opacity-100"
          style={{
            background: `radial-gradient(circle 200px at var(--mx, 50%) var(--my, 50%), ${template.preview.accent}33, transparent 65%)`,
          }}
        />
        {/* Soft inner sheen — independent layer for depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-between">
          <span
            className="inline-flex h-1.5 w-8 rounded-full transition-all duration-500 group-hover/card:w-14"
            style={{ background: template.preview.accent }}
          />
          <div className="space-y-2">
            <div className="text-lg font-semibold leading-tight line-clamp-3">
              {template.preview.sampleHeading}
            </div>
            <div
              className="text-[13px] opacity-80 line-clamp-2"
              style={{ color: template.preview.foreground }}
            >
              {template.preview.sampleNote}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-paper-line bg-white px-4 py-3">
        <div className="text-sm font-medium text-ink">{template.name}</div>
        <div className="truncate text-[11px] text-ink-faint">
          {template.tagline}
        </div>
      </div>
    </article>
  );
}
