import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

interface Persona {
  kicker: string;
  title: string;
  body: string;
  source: string;
  template: string;
}

const PERSONAS: Persona[] = [
  {
    kicker: "Founders",
    title: "Turn launch notes into launch posts.",
    body: "Your changelog already explains the why. Readopp turns release notes, funding announcements, and product essays into carousels that read like a keynote slide, not a press release.",
    source: "Launch announcement",
    template: "Bento Board",
  },
  {
    kicker: "Engineers",
    title: "Make the RFC legible to the feed.",
    body: "The design doc was the hard part. Paste the post-mortem, the architecture write-up, or the arXiv paper and get panels that keep the precision — figures, trade-offs, terminal aesthetics intact.",
    source: "Technical deep-dive",
    template: "Engineering Spec",
  },
  {
    kicker: "Writers",
    title: "Give the essay a second life.",
    body: "A newsletter issue dies in the inbox after 48 hours. The carousel version — pull-quote first, magazine typography — keeps sending readers back to the original for weeks.",
    source: "Newsletter essay",
    template: "Editorial Broadsheet",
  },
  {
    kicker: "Students",
    title: "Post what you study, as you study it.",
    body: "Reading a paper for class anyway? Turn it into a key-findings card and build a public record of what you're learning — the cheapest credibility a student can buy.",
    source: "Research paper",
    template: "Index Card",
  },
];

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="section-amb amb-warm-tr border-b border-paper-line bg-surface"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <SectionLabel title="Who it's for" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
            Different readers, same problem: the good stuff never leaves the
            tab.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PERSONAS.map((p, i) => (
            <Reveal key={p.kicker} delayMs={120 + i * 70}>
              <article className="flex h-full flex-col rounded-2xl border border-paper-line bg-surface p-7 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-transform duration-500 hover:-translate-y-0.5 sm:p-8">
                <div className="text-[13px] font-semibold tracking-tight text-accent">
                  {p.kicker}
                </div>
                <h3 className="mt-3 font-display text-xl font-medium tracking-tight text-ink sm:text-2xl">
                  {p.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {p.body}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-paper-line pt-5 text-xs text-ink-muted">
                  <span>{p.source}</span>
                  <span aria-hidden className="text-ink-faint">
                    →
                  </span>
                  <span className="text-ink">{p.template}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
