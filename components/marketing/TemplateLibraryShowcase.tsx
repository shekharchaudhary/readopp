"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Editorial specimen sheet for the template library. Five chapters
 * (one per category), three specimens per chapter, each specimen is
 * a bespoke mini-render of the actual format it represents — a
 * receipt looks like a receipt, a magazine cover looks like a magazine
 * cover, a terminal looks like a terminal. The whole point of
 * Readopp's templates is that they borrow trust from formats people
 * already recognize, so the showcase should *show* the format, not
 * narrate it from a generic card with a label that says "Receipt".
 *
 * No marquee, no parallax. The display is a magazine-style spread that
 * reveals on scroll with a quiet stagger — designed to look like a
 * designer's spec sheet, not a SaaS carousel.
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
  | "risograph-zine";

interface TemplateMeta {
  id: TemplateId;
  name: string;
  tagline: string;
}

interface Chapter {
  name: string;
  caption: string;
  templates: TemplateMeta[];
}

const CHAPTERS: Chapter[] = [
  {
    name: "Editorial",
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
        id: "risograph-zine",
        name: "Risograph Zine",
        tagline: "Two-color riso with misregistration.",
      },
    ],
  },
];

export function TemplateLibraryShowcase() {
  return (
    <div className="mt-16 sm:mt-20">
      <div className="space-y-20 sm:space-y-28">
        {CHAPTERS.map((c, i) => (
          <ChapterRow key={c.name} chapter={c} index={i} />
        ))}
      </div>

      <div className="mt-20 flex justify-center">
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

function ChapterRow({
  chapter,
  index,
}: {
  chapter: Chapter;
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref}>
      {/* Chapter header — editorial chapter mark on the left, caption
          on the right, like a real magazine spread. */}
      <div
        className="mb-10 grid gap-x-10 gap-y-3 border-b border-paper-line pb-6 sm:grid-cols-[auto_1fr] sm:items-end"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(14px)",
          transition:
            "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] tracking-[0.3em] text-accent">
            CH. {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            {chapter.name}
          </h3>
        </div>
        <p className="max-w-xl text-sm text-ink-soft sm:justify-self-end sm:text-right sm:text-base">
          {chapter.caption}
        </p>
      </div>

      {/* Three specimens per chapter, stagger-revealed. */}
      <div className="grid gap-8 sm:grid-cols-3 sm:gap-7">
        {chapter.templates.map((t, i) => (
          <FormatCard
            key={t.id}
            template={t}
            revealed={revealed}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}

function FormatCard({
  template,
  revealed,
  index,
}: {
  template: TemplateMeta;
  revealed: boolean;
  index: number;
}) {
  const delay = 140 + index * 140;
  return (
    <article
      className="group"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 800ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 900ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-paper-line bg-white shadow-[0_2px_6px_rgba(15,17,21,0.05)] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-[0_30px_60px_-25px_rgba(15,17,21,0.25)]">
        <FormatPreview templateId={template.id} />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 px-1">
        <div className="text-sm font-medium text-ink">{template.name}</div>
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
    case "risograph-zine":
      return <RisographZinePreview />;
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
