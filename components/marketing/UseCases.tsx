import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { TemplateLibraryShowcase } from "./TemplateLibraryShowcase";

export function UseCases() {
  return (
    <section id="use-cases" className="section-amb amb-bl border-b border-paper-line bg-white">
      <div className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="01" title="The template library" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Fifteen templates, five categories &mdash; pick one that already
            feels like you.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Each template commits to a real format &mdash; a magazine cover, a
            receipt, a terminal session &mdash; so the carousel looks borrowed
            from somewhere your audience already trusts.
          </p>
        </Reveal>

        <Reveal delayMs={180}>
          <TemplateLibraryShowcase />
        </Reveal>
      </div>
    </section>
  );
}
