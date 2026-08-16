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
import { TemplateGallery } from "@/components/marketing/TemplateGallery";
import { UseCases } from "@/components/marketing/UseCases";

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        <section className="studio-hero relative overflow-hidden border-b border-paper-line bg-paper">
          <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,.88fr)] lg:items-start lg:gap-16">
              <div className="relative z-10">
                <Reveal delayMs={60}>
                  <div className="mb-8 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-deep">
                    <span className="h-px w-10 bg-sky" />
                    AI visual publishing studio
                  </div>
                </Reveal>

                <Reveal delayMs={120}>
                  <h1 className="max-w-[820px] font-display text-[52px] font-medium leading-[0.96] tracking-[-0.045em] text-ink sm:text-[72px] lg:text-[82px] xl:text-[92px]">
                    Your best reads,
                    <span className="block italic text-sky-deep">made visible.</span>
                  </h1>
                </Reveal>

                <Reveal delayMs={180}>
                  <div className="mt-8 grid max-w-2xl gap-5 border-l border-sky/40 pl-5 sm:grid-cols-[1fr_auto] sm:items-end sm:pl-7">
                    <p className="text-base leading-7 text-ink-soft sm:text-lg">
                      Turn articles, papers, and PDFs into thoughtful visual
                      carousels—structured, sourced, and ready to publish.
                    </p>
                    <div className="hidden pb-1 text-right font-mono text-[10px] uppercase leading-5 tracking-[0.16em] text-ink-muted sm:block">
                      Read · distill<br />design · publish
                    </div>
                  </div>
                </Reveal>

                <Reveal delayMs={240}>
                  <div id="try" className="studio-console mt-10 max-w-2xl overflow-hidden rounded-[24px] border border-paper-line bg-surface shadow-[0_30px_80px_-40px_rgba(20,32,60,.35)]">
                    <div className="flex items-center justify-between border-b border-paper-line bg-paper-soft/70 px-5 py-3">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                        <span className="h-2 w-2 rounded-full bg-sky" />
                        New visual brief
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint">01 / CREATE</span>
                    </div>
                    <div className="p-5 sm:p-7"><UrlInput /></div>
                  </div>
                </Reveal>

                <Reveal delayMs={290}>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                    <span>03 free generations</span><span>No card required</span><span>PDF up to 25 MB</span>
                  </div>
                </Reveal>
              </div>

              <Reveal delayMs={260}>
                <aside className="relative mx-auto w-full max-w-[520px] lg:sticky lg:top-28">
                  <div className="absolute -left-5 -top-5 hidden h-24 w-24 border-l border-t border-sky/40 sm:block" />
                  <div className="absolute -bottom-4 -right-4 hidden font-display text-8xl italic leading-none text-sky/10 sm:block">R</div>
                  <div className="relative rounded-[28px] bg-[#111827] p-3 shadow-[0_40px_90px_-35px_rgba(8,15,30,.65)] sm:p-5">
                    <div className="mb-4 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                      <span>Live output preview</span><span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-[#6ee7b7]" /> Ready</span>
                    </div>
                    <div className="force-light overflow-hidden rounded-2xl"><HeroPostMockup /></div>
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-5 border-t border-paper-line pt-4">
                    <p className="max-w-xs text-xs leading-5 text-ink-muted">A long-form article becomes an editable, source-aware carousel in minutes.</p>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-sky-deep">Actual output ↗</span>
                  </div>
                </aside>
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
