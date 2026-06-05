import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

/**
 * "Replaces the workflow you have" — the section that names the displaced
 * ChatGPT + Canva flow and shows Readopp's one-shot path side by side.
 * Speaks directly to the LinkedIn-poster persona; doesn't talk about AI
 * mechanics. Sits between the platforms strip and "How it works".
 */

interface Row {
  step: string;
  before: string;
  beforeMins: string;
  afterMins: string;
  afterNote: string;
  collapsed?: boolean;
}

const ROWS: Row[] = [
  {
    step: "Read the article",
    before: "10 min",
    beforeMins: "10 min",
    afterMins: "10 min",
    afterNote: "Same as before — this part you keep.",
  },
  {
    step: "Summarise it",
    before: "Open ChatGPT, paste article, prompt for a summary",
    beforeMins: "~3 min",
    afterMins: "Skip",
    afterNote: "Six agents read and outline it for you.",
    collapsed: true,
  },
  {
    step: "Design the visuals",
    before: "Open Canva, pick a template, build slide-by-slide",
    beforeMins: "5–10 min",
    afterMins: "Skip",
    afterNote: "Panels drawn in editorial style, ready to post.",
    collapsed: true,
  },
  {
    step: "Caption + hashtags",
    before: "Re-prompt ChatGPT for caption, copy-paste, edit",
    beforeMins: "~2 min",
    afterMins: "Skip",
    afterNote: "Generated in the user's voice from the source.",
    collapsed: true,
  },
  {
    step: "Post it",
    before: "Upload images one by one, paste caption, post",
    beforeMins: "~2 min",
    afterMins: "One click",
    afterNote: "Carousel + caption opens in LinkedIn compose, ready to send.",
  },
];

export function WorkflowComparison() {
  return (
    <section
      id="replaces"
      className="border-y border-paper-line bg-paper-soft/40"
    >
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-28">
        <Reveal>
          <SectionLabel number="00" title="Replaces the workflow you have" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Today: ChatGPT, then Canva, then LinkedIn.{" "}
            <span className="text-ink-muted">~20 minutes per post.</span>
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Readopp collapses the middle four steps. You keep the reading —
            we handle the translation to a post.
          </p>
        </Reveal>

        <div className="mt-14 overflow-hidden rounded-xl border border-paper-line bg-white">
          {/* Header row */}
          <div className="grid grid-cols-[1.1fr_1.4fr_1fr] gap-4 border-b border-paper-line px-6 py-3 sm:grid-cols-[1.2fr_1.6fr_0.6fr_1.4fr_0.6fr]">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              Step
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              Today
            </div>
            <div className="hidden text-[10px] font-medium uppercase tracking-wider text-ink-faint sm:block">
              Time
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-accent">
              With Readopp
            </div>
            <div className="hidden text-[10px] font-medium uppercase tracking-wider text-ink-faint sm:block">
              Time
            </div>
          </div>

          {ROWS.map((row, i) => (
            <Reveal key={row.step} delayMs={i * 40}>
              <div
                className={
                  "grid grid-cols-[1.1fr_1.4fr_1fr] items-start gap-4 px-6 py-5 sm:grid-cols-[1.2fr_1.6fr_0.6fr_1.4fr_0.6fr] " +
                  (i < ROWS.length - 1 ? "border-b border-paper-line" : "")
                }
              >
                <div className="text-sm font-medium text-ink sm:text-[15px]">
                  {row.step}
                </div>
                <div
                  className={
                    "text-sm leading-relaxed sm:text-[14px] " +
                    (row.collapsed
                      ? "text-ink-muted line-through decoration-ink-faint decoration-1 underline-offset-2"
                      : "text-ink-soft")
                  }
                >
                  {row.before}
                </div>
                <div className="hidden font-mono text-[11px] text-ink-muted sm:block">
                  {row.beforeMins}
                </div>
                <div className="text-sm leading-relaxed text-ink-soft sm:text-[14px]">
                  <span className="font-medium text-ink">{row.afterMins}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {row.afterNote}
                  </span>
                </div>
                <div className="hidden font-mono text-[11px] text-accent sm:block">
                  {row.afterMins}
                </div>
              </div>
            </Reveal>
          ))}

          {/* Total row */}
          <div className="grid grid-cols-[1.1fr_1.4fr_1fr] items-baseline gap-4 border-t border-paper-line bg-paper-soft px-6 py-4 sm:grid-cols-[1.2fr_1.6fr_0.6fr_1.4fr_0.6fr]">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Total
            </div>
            <div className="text-sm text-ink-soft">
              Three tools, a lot of switching.
            </div>
            <div className="hidden font-mono text-sm font-medium text-ink-soft sm:block">
              ~22 min
            </div>
            <div className="text-sm text-ink-soft">
              One tool, one verb.
            </div>
            <div className="hidden font-mono text-sm font-medium text-accent sm:block">
              ~10 min
            </div>
          </div>
        </div>

        <Reveal delayMs={240}>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-muted">
            You still pick what to read — that&rsquo;s the part with taste.
            Readopp removes the design tax on what you already understand,
            so posting becomes the easiest part of your week.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
