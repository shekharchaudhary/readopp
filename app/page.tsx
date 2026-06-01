import { ExampleGallery } from "@/components/ExampleGallery";
import { HeroPreview } from "@/components/HeroPreview";
import { UrlInput } from "@/components/UrlInput";
import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Nav } from "@/components/marketing/Nav";
import { PlatformsStrip } from "@/components/marketing/PlatformsStrip";
import { Reveal } from "@/components/marketing/Reveal";
import { SectionLabel } from "@/components/marketing/SectionLabel";
import { UseCases } from "@/components/marketing/UseCases";

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* Hero — single column, generous whitespace, no marketing chrome. */}
        <section className="bg-paper">
          <div className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                Readopp — an experiment in agent-rendered explainers
              </p>
            </Reveal>
            <Reveal delayMs={80}>
              <h1 className="mt-8 max-w-4xl text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
                Turn a careful article into a{" "}
                <span className="text-accent-deep">visual explainer</span>{" "}
                you can share.
              </h1>
            </Reveal>
            <Reveal delayMs={160}>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                Paste a URL. Six agents — Read, Understand, Outline, Plan, Draw,
                Assemble — pass the article down a pipeline and produce a short
                sequence of clean panels. You watch them work in real time.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
              <Reveal delayMs={220}>
                <HeroPreview />
              </Reveal>
              <Reveal delayMs={260}>
                <div
                  id="try"
                  className="rounded-lg border border-paper-line bg-white p-7"
                >
                  <p className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                    Try it
                  </p>
                  <UrlInput />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <PlatformsStrip />

        <HowItWorks />

        <UseCases />

        {/* Recent runs — quietly framed as an index, not a marketing wall. */}
        <section className="border-b border-paper-line bg-white">
          <div className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
            <Reveal>
              <SectionLabel number="03" title="Recent runs" />
            </Reveal>
            <Reveal delayMs={60}>
              <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
                A handful of explainers Readopp has generated.
              </h2>
            </Reveal>
            <Reveal delayMs={120}>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
                Each one is a real run — open any to see the full set of panels
                and the article it came from.
              </p>
            </Reveal>
            <div className="mt-12">
              <ExampleGallery />
            </div>
          </div>
        </section>

        <FAQ />

        <Footer />
      </main>
    </>
  );
}
