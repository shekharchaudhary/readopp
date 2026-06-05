import { HeroPreview } from "@/components/HeroPreview";
import { UrlInput } from "@/components/UrlInput";
import { YourExplainersSection } from "@/components/YourExplainersSection";
import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Nav } from "@/components/marketing/Nav";
import { PlatformsStrip } from "@/components/marketing/PlatformsStrip";
import { Reveal } from "@/components/marketing/Reveal";
import { UseCases } from "@/components/marketing/UseCases";
import { WorkflowComparison } from "@/components/marketing/WorkflowComparison";

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* Hero — leads with the wedge: you shouldn't have to design what
            you already understand. Framed for the poster persona, not the
            AI mechanism. */}
        <section className="bg-paper">
          <div className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
                Visual posts from anything you read
              </p>
            </Reveal>
            <Reveal delayMs={80}>
              <h1 className="mt-8 max-w-4xl text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
                You shouldn&rsquo;t have to design what you{" "}
                <span className="text-[#1E9EEF]">already understand</span>.
              </h1>
            </Reveal>
            <Reveal delayMs={160}>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                Paste any article, paper, or PDF. Readopp turns it into a
                LinkedIn-ready visual carousel in under 30 seconds — with
                editorial polish, captions, and panels already sized for the
                feed. The shortest path from great read to great post.
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
                    Make your first post
                  </p>
                  <UrlInput />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <PlatformsStrip />

        <WorkflowComparison />

        <HowItWorks />

        <UseCases />

        {/* Personalised — only renders once the user has at least one explainer. */}
        <YourExplainersSection />

        <FAQ />

        <Footer />
      </main>
    </>
  );
}
