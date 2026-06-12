import { UrlInput } from "@/components/UrlInput";
import { YourExplainersSection } from "@/components/YourExplainersSection";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";
import { HeroPostMockup } from "@/components/marketing/HeroPostMockup";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Nav } from "@/components/marketing/Nav";
import { PlatformsStrip } from "@/components/marketing/PlatformsStrip";
import { Pricing } from "@/components/marketing/Pricing";
import { Reveal } from "@/components/marketing/Reveal";
import { StartHerePointer } from "@/components/marketing/StartHerePointer";
import { TemplateGallery } from "@/components/marketing/TemplateGallery";
import { UseCases } from "@/components/marketing/UseCases";

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* Hero — leads with the wedge ("you shouldn't have to design what
            you already understand") and grounds it visually with a LinkedIn
            post mockup containing a real Readopp carousel. */}
        <section className="section-amb amb-tr bg-paper">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
              {/* Left: copy + CTA */}
              <div>
                <Reveal>
                  <span className="inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-3.5 py-1.5 text-xs font-medium tracking-tight text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
                    Visual posts from anything you read
                  </span>
                </Reveal>
                <Reveal delayMs={80}>
                  <h1 className="mt-6 max-w-2xl font-display text-[44px] font-medium leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[64px]">
                    You shouldn&rsquo;t have to design what you{" "}
                    <em className="hl-sweep not-italic box-decoration-clone rounded-lg px-2 text-accent-deep">
                      already understand
                    </em>
                    .
                  </h1>
                </Reveal>
                <Reveal delayMs={160}>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                    Paste any article, paper, or PDF. Readopp turns it into a
                    LinkedIn-ready visual carousel in under 30 seconds — with
                    editorial polish, captions, and panels already sized for
                    the feed. The shortest path from great read to great post.
                  </p>
                </Reveal>

                <Reveal delayMs={220}>
                  <div
                    id="try"
                    className="relative mt-8 rounded-xl border border-paper-line bg-surface p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.10)]"
                  >
                    <StartHerePointer />
                    <UrlInput />
                  </div>
                </Reveal>

                <Reveal delayMs={260}>
                  <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                    <span>3 free posts</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>no credit card</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>works with any URL or PDF</span>
                  </p>
                </Reveal>
              </div>

              {/* Right: the LinkedIn post mockup */}
              <Reveal delayMs={300}>
                <div className="lg:pl-4">
                  <HeroPostMockup />
                  <p className="mt-3 px-2 text-center text-xs text-ink-muted">
                    A 4,000-word article became this carousel in 22 seconds.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <PlatformsStrip />

        <TemplateGallery />

        <HowItWorks />

        <UseCases />

        {/* Personalised — only renders once the user has at least one explainer. */}
        <YourExplainersSection />

        <Pricing />

        <FAQ />

        <FinalCTA />

        <Footer />
      </main>
    </>
  );
}
