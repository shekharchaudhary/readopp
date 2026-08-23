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
            <h1 className="landing-enter landing-enter-2 mx-auto mt-7 max-w-[900px] font-sans text-[48px] font-bold leading-[1.01] tracking-[-.058em] text-[#484848] sm:text-[72px] lg:text-[86px]">
              Turn what you read into
              <span className="relative mx-auto block w-fit text-[#7eae3f]">
                something worth sharing
                <svg aria-hidden className="hero-squiggle absolute -bottom-3 left-0 h-4 w-full" viewBox="0 0 500 20" preserveAspectRatio="none">
                  <path d="M5 12 C95 2, 165 18, 250 9 S405 4, 495 12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="landing-enter landing-enter-3 mx-auto mt-10 max-w-2xl text-lg leading-8 text-[#626262] sm:text-xl">
              Too busy to create for LinkedIn, X, or Substack? Readopp turns
              anything you read into creative templates, posts, short videos,
              and articles you can publish in minutes.
            </p>

            <div id="try" className="hero-composer landing-enter landing-enter-4 mx-auto mt-10 max-w-[760px] rounded-[24px] border border-[#dcdcdc] bg-white p-5 text-left shadow-[0_24px_70px_-42px_rgba(72,72,72,.4)] sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7eae3f]">Start with your document</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#484848]">Where does it live?</h2>
                </div>
                <span className="hidden text-xs text-[#999] sm:block">3 free stories · no card</span>
              </div>
              <UrlInput />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-stage border-b border-[#eadfd2] bg-[#fff5e9]">
          <div className="mx-auto max-w-[1160px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <HowItWorksShowcase />
          </div>
        </section>

        <section id="pricing" className="pricing-stage overflow-hidden bg-[#f2ebf7]">
          <div className="relative mx-auto max-w-[1080px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-20">
              <div className="max-w-[430px]">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9b64b5]">Pricing</p>
                <h2 className="mt-4 text-4xl font-bold tracking-[-.05em] text-[#484848] sm:text-5xl">Start free.<br />Pay when it sticks.</h2>
                <p className="mt-6 max-w-sm text-base leading-7 text-[#716d75]">
                  Make your first three visual stories free. Upgrade when
                  publishing becomes part of your weekly rhythm.
                </p>
                <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-[#625d66]">
                  <span className="rounded-full border border-[#d8cde0] bg-white/55 px-3 py-2">No card to start</span>
                  <span className="rounded-full border border-[#d8cde0] bg-white/55 px-3 py-2">Cancel anytime</span>
                </div>
              </div>

              <article className="pricing-card plan-card w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#484848] p-6 text-white shadow-[0_32px_70px_-42px_rgba(72,72,72,.72)] sm:p-8 lg:ml-auto">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#cce68a]">Author</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-[-.035em]">A steady publishing practice</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white/75">Weekly</span>
                </div>

                <div className="mt-8 flex items-end gap-2 border-b border-white/15 pb-7">
                  <span className="text-5xl font-bold tracking-[-.055em]">$9.99</span>
                  <span className="pb-1 text-sm text-white/55">per month</span>
                </div>

                <div className="publishing-rhythm my-6 rounded-2xl border border-white/10 bg-white/[.055] p-4">
                  <div className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.13em]">
                    <span className="text-white/55">Publishing rhythm</span>
                    <span className="text-[#cce68a]">4 weeks</span>
                  </div>
                  <div className="cadence-track" aria-hidden>
                    <span className="cadence-progress" />
                    {["W1", "W2", "W3", "W4"].map((week, index) => (
                      <span key={week} className="cadence-week" style={{ "--week": index } as React.CSSProperties}>
                        <span className="cadence-dot" />
                        <span>{week}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <ul className="grid gap-3 text-sm text-white/75 sm:grid-cols-3">
                  {["60 stories / month", "Every export format", "No watermark"].map((feature) => (
                    <li key={feature} className="pricing-feature flex items-center gap-2">
                      <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#cce68a] text-[11px] font-bold text-[#484848]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a href="#try" className="pricing-cta mt-7 flex items-center justify-between rounded-2xl bg-[#cce68a] px-5 py-4 text-sm font-bold text-[#484848] transition-colors hover:bg-[#d8ef9d]">
                  <span>Choose Author</span>
                  <span aria-hidden className="pricing-arrow text-lg">→</span>
                </a>
              </article>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
