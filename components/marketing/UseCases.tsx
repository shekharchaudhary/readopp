import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

const CASES = [
  {
    title: "Technical blog posts",
    body: "A four-thousand-word piece about how a system works becomes six panels — clear enough to drop into a deck, short enough for a Reel.",
    example: "How transformers think · How AI agents remember projects",
  },
  {
    title: "Research papers",
    body: "Pull the core claim, the method, the results, and the caveat out of dense academic writing — without softening what the author said.",
    example: "arXiv preprints · ML papers · whitepapers",
  },
  {
    title: "Product launches",
    body: "Turn a launch announcement into a swipeable explainer for your team or community in under a minute.",
    example: "Changelogs · feature announcements · API docs",
  },
  {
    title: "Long newsletters",
    body: "Compress a twenty-minute read into a twenty-five-second video that respects what the writer actually argued.",
    example: "Substack essays · weekly digests · investor letters",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="border-b border-paper-line bg-white">
      <div className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="02" title="What it's for" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Built for the writing that&rsquo;s hardest to share.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Long, careful, technical writing usually dies on social feeds — too
            much to read, no hook. Readopp gives it a second life as something
            you&rsquo;ll actually post.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-paper-line bg-paper-line sm:grid-cols-2">
          {CASES.map((c, i) => (
            <Reveal key={c.title} delayMs={i * 60}>
              <article className="flex h-full flex-col bg-white p-8">
                <h3 className="text-lg font-medium tracking-tight text-ink">
                  {c.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-ink-soft">
                  {c.body}
                </p>
                <p className="mt-6 font-mono text-xs text-ink-faint">
                  {c.example}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
