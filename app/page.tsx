import { WaterfallText } from "@/components/marketing/WaterfallText";
import { MARKETING_COPY } from "@/lib/marketingCopy";
import { CursorMotionRegion, CursorText } from "@/components/ui/CursorText";
import { CursorHeadline } from "@/components/marketing/CursorHeadline";
import { UrlInput } from "@/components/UrlInput";
import { Footer } from "@/components/marketing/Footer";
import { HowItWorksShowcase } from "@/components/marketing/HowItWorksShowcase";
import { Nav } from "@/components/marketing/Nav";

export default function HomePage() {
  return (
    <div className="landing-page bg-paper text-ink">
      <Nav />
      <main>
        <section className="landing-hero napkin-grid border-b border-paper-line bg-paper">
          <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-24 sm:pt-24 lg:px-12">
            <p className="hero-kicker landing-enter landing-enter-1 mx-auto w-fit rounded-full border border-paper-line bg-surface px-4 py-2 text-xs font-semibold text-ink-soft">
              Articles, research, documents, and notes
            </p>
            <CursorHeadline />
            <WaterfallText text={MARKETING_COPY.description} className="landing-enter landing-enter-3 mx-auto mt-10 max-w-2xl text-lg leading-8 text-ink-soft sm:text-xl" />

            <CursorMotionRegion id="try" className="hero-composer landing-enter landing-enter-4 mx-auto mt-10 max-w-[760px] rounded-[24px] border border-paper-line bg-surface p-5 text-left shadow-[0_24px_70px_-42px_rgba(72,72,72,.4)] sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] landing-green"><CursorText text="Start with a source" /></p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-ink"><CursorText text="What are you reading?" /></h2>
                </div>
                <span className="hidden text-xs text-ink-muted sm:block"><CursorText text="Your source. Your perspective." /></span>
              </div>
              <UrlInput />
            </CursorMotionRegion>
          </div>
        </section>

        <section id="how-it-works" className="how-stage landing-how border-b border-paper-line">
          <div className="mx-auto max-w-[1160px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <HowItWorksShowcase />
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
