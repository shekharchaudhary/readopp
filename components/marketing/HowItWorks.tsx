import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

const STEPS = [
  {
    n: "01",
    title: "Paste a URL",
    body: "Any article — a technical blog post, a research paper, a launch announcement, a long newsletter. We fetch the page and strip the chrome.",
  },
  {
    n: "02",
    title: "Six agents read it",
    body: "Read, Understand, Outline, Plan, Draw, Assemble. Each agent does one job; you watch them work in real time, with a transcript of every decision.",
  },
  {
    n: "03",
    title: "Panels compose themselves",
    body: "The model produces a sequence of diagrams — flowcharts, comparisons, timelines, stat callouts. Real vector text, real structure, captioned from the source.",
  },
  {
    n: "04",
    title: "Share it anywhere",
    body: "Export as a vertical MP4 for Reels and TikTok, a square for Instagram, a landscape for LinkedIn. Every frame carries a QR back to the full explainer.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="01" title="How it works" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            A team of agents, not a single prompt.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Readopp doesn&rsquo;t ask one model to do everything. The work
            splits into six small, observable steps — so you can see what&rsquo;s
            happening, and trust the output.
          </p>
        </Reveal>

        <ol className="mt-16 divide-y divide-paper-line border-y border-paper-line">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delayMs={i * 60}>
              <li className="grid gap-2 py-8 sm:grid-cols-[120px_1fr] sm:gap-10 sm:py-10">
                <div className="font-mono text-base font-medium tabular-nums text-accent sm:text-lg">
                  {step.n}
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
