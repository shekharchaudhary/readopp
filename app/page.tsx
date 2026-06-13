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
        {/* Hero — centered headline, then a numbered two-step narration
            (Napkin-style): ① paste what you read into the real input,
            ② the post mockup shows what comes out. */}
        <section className="section-amb amb-tr bg-paper">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-3.5 py-1.5 text-xs font-medium tracking-tight text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
                  Visual posts from anything you read
                </span>
              </Reveal>
              <Reveal delayMs={80}>
                <h1 className="mt-6 font-display text-[44px] font-medium leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[64px]">
                  You shouldn&rsquo;t have to design what you{" "}
                  <em className="hl-sweep hl-coral not-italic box-decoration-clone rounded-lg px-2 text-coral-deep">
                    already understand
                  </em>
                  .
                </h1>
              </Reveal>
              <Reveal delayMs={160}>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
                  Readopp turns whatever you&rsquo;re reading into a
                  feed-ready visual carousel — editorial polish, caption
                  included, in under 30 seconds.
                </p>
              </Reveal>
            </div>

            {/* Step 1 — paste or upload */}
            <div className="mt-16 grid gap-10 sm:mt-24 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
              <div>
                <Reveal>
                  <StepBadge n={1} className="bg-sky" />
                </Reveal>
                <Reveal delayMs={70}>
                  <h2 className="mt-5 max-w-md font-display text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
                    Start by{" "}
                    <strong className="font-semibold text-sky-deep">
                      pasting
                    </strong>{" "}
                    or{" "}
                    <strong className="font-semibold text-sky-deep">
                      uploading
                    </strong>{" "}
                    what you read.
                  </h2>
                </Reveal>
                <Reveal delayMs={140}>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base">
                    Any article URL, PDF, newsletter issue, or research paper.
                    No formatting, no prompt-writing — the source is the
                    input.
                  </p>
                </Reveal>
                <Reveal delayMs={200}>
                  <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                    <span>3 free posts</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>no credit card</span>
                    <span aria-hidden className="text-ink-faint">·</span>
                    <span>no sign-up to try</span>
                  </p>
                </Reveal>
              </div>

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
            </div>

            {/* Step 2 — the post that comes out */}
            <div className="mt-20 grid gap-10 sm:mt-28 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
              <div className="lg:order-2">
                <Reveal>
                  <StepBadge n={2} className="bg-coral" />
                </Reveal>
                <Reveal delayMs={70}>
                  <h2 className="mt-5 max-w-md font-display text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
                    Get a{" "}
                    <strong className="font-semibold text-coral-deep">
                      post
                    </strong>{" "}
                    your feed already trusts.
                  </h2>
                </Reveal>
                <Reveal delayMs={140}>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base">
                    Six agents read, outline, and draw — you get a swipeable
                    carousel with a caption, already sized for LinkedIn,
                    Instagram, or TikTok. Edit any panel before you export.
                  </p>
                </Reveal>
              </div>

              <div className="lg:order-1 lg:pr-4">
                <Reveal delayMs={180}>
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

/** Napkin-style numbered step marker: hued circle, white numeral. */
function StepBadge({ n, className = "bg-ink" }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-medium text-white ${className}`}
    >
      {n}
    </span>
  );
}
