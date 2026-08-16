import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { Squiggle } from "./Squiggle";
import { TemplateLibraryShowcase } from "./TemplateLibraryShowcase";

export function TemplateGallery() {
  return (
    <section
      id="templates"
      className="section-amb border-b border-paper-line bg-surface"
    >
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <div className="grid gap-7 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
          <Reveal><SectionLabel title="Visual identity library" tone="sky" /></Reveal>
          <div>
            <Reveal delayMs={60}>
              <h2 className="font-display text-4xl font-medium leading-[1.02] tracking-[-.035em] text-ink sm:text-5xl">One idea. Twenty ways to make it <Squiggle>unmistakable</Squiggle>.</h2>
            </Reveal>
            <Reveal delayMs={120}>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">Not skins. Publishing systems. Each identity reshapes type, rhythm, framing, metadata, and attribution around a medium people already recognize.</p>
            </Reveal>
          </div>
        </div>

        <Reveal delayMs={180}>
          <TemplateLibraryShowcase />
        </Reveal>
      </div>
    </section>
  );
}
