import { CursorMotionRegion, CursorText } from "@/components/ui/CursorText";
import { CursorHeadline } from "@/components/marketing/CursorHeadline";
import { UrlInput } from "@/components/UrlInput";
import { Footer } from "@/components/marketing/Footer";
import { HowItWorksShowcase } from "@/components/marketing/HowItWorksShowcase";
import { Nav } from "@/components/marketing/Nav";

export default function HomePage() {
  return (
    <div className="force-light bg-white text-[#484848]">
      <Nav />
      <main>
        <section className="landing-hero napkin-grid border-b border-[#e8e8e8] bg-white">
          <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-24 sm:pt-24 lg:px-12">
            <p className="hero-kicker landing-enter landing-enter-1 mx-auto w-fit rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-xs font-semibold text-[#666]">
              For articles, papers, newsletters, and PDFs
            </p>
            <CursorHeadline />
            <p className="landing-enter landing-enter-3 mx-auto mt-10 max-w-2xl text-lg leading-8 text-[#626262] sm:text-xl">
              Too busy to create for LinkedIn, X, or Substack? Readopp turns
              anything you read into creative templates, posts, short videos,
              and articles you can publish in minutes.
            </p>

            <CursorMotionRegion id="try" className="hero-composer landing-enter landing-enter-4 mx-auto mt-10 max-w-[760px] rounded-[24px] border border-[#dcdcdc] bg-white p-5 text-left shadow-[0_24px_70px_-42px_rgba(72,72,72,.4)] sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7eae3f]"><CursorText text="Start with your document" /></p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#484848]"><CursorText text="Where does it live?" /></h2>
                </div>
                <span className="hidden text-xs text-[#999] sm:block"><CursorText text="3 free stories · no card" /></span>
              </div>
              <UrlInput />
            </CursorMotionRegion>
          </div>
        </section>

        <section id="how-it-works" className="how-stage border-b border-[#eadfd2] bg-[#fff5e9]">
          <div className="mx-auto max-w-[1160px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <HowItWorksShowcase />
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
