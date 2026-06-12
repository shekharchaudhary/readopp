import { AgentDemoReel } from "./AgentDemoReel";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { Squiggle } from "./Squiggle";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-amb amb-tl border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <SectionLabel title="How it works" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
            A team of <Squiggle>agents</Squiggle>, not a single prompt.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Readopp doesn&rsquo;t ask one model to do everything. The work
            splits into six small, observable steps — so you can see what&rsquo;s
            happening, and trust the output. Watch the whole pipeline run:
          </p>
        </Reveal>

        <Reveal delayMs={200}>
          <div className="mx-auto mt-14 max-w-4xl">
            <AgentDemoReel />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
