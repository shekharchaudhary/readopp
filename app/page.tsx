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
import { SourceFlow } from "@/components/marketing/SourceFlow";
import { TemplateGallery } from "@/components/marketing/TemplateGallery";
import { UseCases } from "@/components/marketing/UseCases";

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* Hero — one unified "input → Readopp → output" sentence:
            source pills feed the real UrlInput on the left, the
            LinkedIn-style HeroPostMockup on the right, hand-drawn
            bridge between them. Reads at a glance, no step-by-step
            tutorial in the hero (HowItWorks below explains the how). */}
        <section className="section-amb amb-tr bg-paper">
          <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal delayMs={80}>
                <h1 className="font-display text-[44px] font-medium leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[64px]">
                  Turn what you read into a{" "}
                  <em className="hl-sweep hl-mint not-italic box-decoration-clone rounded-lg px-2 text-ink">
                    LinkedIn-ready post
                  </em>
                  .
                </h1>
              </Reveal>
              <Reveal delayMs={160}>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
                  Articles, research papers, newsletters, even books — if
                  turning a great read into a feed-worthy carousel feels harder
                  than the article itself, paste a link. Readopp designs the
                  post for you.
                </p>
              </Reveal>
            </div>

            <div className="mt-14 grid items-center gap-10 sm:mt-20 lg:grid-cols-[1fr_auto_1.05fr] lg:gap-6">
              {/* Input — real CTA. Source pills above + arrows feed the URL card. */}
              <div>
                <Reveal delayMs={180}>
                  <SourceFlow>
                    <div
                      id="try"
                      className="relative rounded-xl border border-paper-line bg-surface p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.10)]"
                    >
                      <UrlInput />
                    </div>
                  </SourceFlow>
                </Reveal>
                <Reveal delayMs={240}>
                  <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                    <span>3 free posts</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>no credit card</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>no sign-up to try</span>
                  </p>
                </Reveal>
              </div>

              {/* Hand-drawn bridge between input and output. Desktop only —
                  on mobile the columns stack, so the vertical flow is enough. */}
              <div className="hidden lg:block">
                <Reveal delayMs={260}>
                  <HeroBridge />
                </Reveal>
              </div>

              {/* Output — LinkedIn-style carousel post mockup. */}
              <div>
                <Reveal delayMs={300}>
                  <HeroPostMockup />
                  <p className="mt-3 px-2 text-center text-xs text-ink-muted">
                    A 4,000-word article became this carousel in 22 seconds.
                  </p>
                </Reveal>
              </div>
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

/** Bridge between the input card and the post mockup. Tiny accent dot +
 *  "Readopp" wordmark over a hand-drawn arrow — re-uses .flow-arrows so
 *  the curve + chevron draw in on load matching the source arrows above. */
function HeroBridge() {
  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <span className="font-display text-sm font-medium tracking-tight text-ink">
          Readopp
        </span>
      </div>
      <svg
        aria-hidden
        viewBox="0 0 120 32"
        className="flow-arrows mt-3 h-9 w-28 text-ink-soft"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          pathLength={1}
          d="M6 20 C 30 6, 70 30, 100 16 M92 9 L 102 16 L 92 23"
        />
      </svg>
    </div>
  );
}
