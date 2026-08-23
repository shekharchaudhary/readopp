import { UrlInput } from "@/components/UrlInput";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";

export default function HomePage() {
  return (
    <div className="force-light bg-white text-[#484848]">
      <Nav />
      <main>
        <section className="napkin-grid border-b border-[#e8e8e8] bg-white">
          <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-24 sm:pt-24 lg:px-12">
            <p className="mx-auto w-fit rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-xs font-semibold text-[#666]">
              For articles, papers, newsletters, and PDFs
            </p>
            <h1 className="mx-auto mt-7 max-w-[900px] font-sans text-[48px] font-bold leading-[1.01] tracking-[-.058em] text-[#484848] sm:text-[72px] lg:text-[86px]">
              Turn a good read into a
              <span className="relative mx-auto block w-fit text-[#7eae3f]">
                post worth saving
                <svg aria-hidden className="absolute -bottom-3 left-0 h-4 w-full" viewBox="0 0 500 20" preserveAspectRatio="none">
                  <path d="M5 12 C95 2, 165 18, 250 9 S405 4, 495 12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mx-auto mt-10 max-w-2xl text-lg leading-8 text-[#626262] sm:text-xl">
              Readopp finds the argument and evidence in your source, then turns
              them into a clear, sourced visual story for LinkedIn or X.
            </p>

            <div id="try" className="mx-auto mt-10 max-w-[760px] rounded-[24px] border border-[#dcdcdc] bg-white p-5 text-left shadow-[0_24px_70px_-42px_rgba(72,72,72,.4)] sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7eae3f]">Start with the source</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-[#484848]">What did you read?</h2>
                </div>
                <span className="hidden text-xs text-[#999] sm:block">3 free stories · no card</span>
              </div>
              <UrlInput />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-[#e8e8e8] bg-[#f8f6f0]">
          <div className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#7eae3f]">How it works</p>
                <h2 className="mt-4 text-4xl font-bold leading-none tracking-[-.05em] text-[#484848] sm:text-5xl">From reading<br />to publishing.</h2>
              </div>
              <ol className="divide-y divide-[#d8d4ca] border-y border-[#d8d4ca]">
                <ProcessStep number="01" title="Bring the source" body="Paste a link or upload the PDF." />
                <ProcessStep number="02" title="Readopp finds the story" body="It identifies the claim, evidence, sequence, and useful tension." />
                <ProcessStep number="03" title="Edit and publish" body="Refine the result, then export it for LinkedIn or X." />
              </ol>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f2ebf7]">
          <div className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-start lg:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9b64b5]">Pricing</p>
                <h2 className="mt-4 text-4xl font-bold tracking-[-.05em] text-[#484848] sm:text-5xl">Start free.<br />Pay when it sticks.</h2>
              </div>
              <div className="w-full max-w-[440px] lg:ml-auto">
                <Plan name="Author" price="$9.99" suffix="/ month" note="For a weekly publishing practice" features={["60 stories each month", "Every export format", "No watermark"]} cta="Choose Author" featured />
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

function ProcessStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <li className="grid gap-2 py-6 sm:grid-cols-[48px_1fr_1.25fr] sm:items-baseline sm:gap-5">
      <span className="text-xs font-bold text-[#7eae3f]">{number}</span>
      <h3 className="text-lg font-bold tracking-[-.025em] text-[#484848]">{title}</h3>
      <p className="text-sm leading-6 text-[#6d6a64]">{body}</p>
    </li>
  );
}

function Plan({ name, price, suffix, note, features, cta, featured = false }: { name: string; price: string; suffix?: string; note: string; features: string[]; cta: string; featured?: boolean }) {
  return (
    <article className={`rounded-[22px] border p-6 ${featured ? "border-[#484848] bg-[#484848] text-white" : "border-black/10 bg-white text-[#484848]"}`}>
      <h3 className="text-xl font-bold">{name}</h3>
      <p className={`mt-1 min-h-10 text-sm leading-5 ${featured ? "text-white/60" : "text-[#777]"}`}>{note}</p>
      <p className="mt-5 text-3xl font-bold tracking-[-.04em]">{price}<span className={`ml-1 text-xs font-normal ${featured ? "text-white/60" : "text-[#777]"}`}>{suffix}</span></p>
      <ul className={`my-5 space-y-2 border-t pt-5 text-sm ${featured ? "border-white/15 text-white/75" : "border-black/10 text-[#666]"}`}>{features.map((feature) => <li key={feature}>✓ &nbsp;{feature}</li>)}</ul>
      <a href="#try" className={`block rounded-xl px-5 py-3 text-center text-sm font-bold ${featured ? "bg-[#cce68a] text-[#484848]" : "bg-[#484848] text-white"}`}>{cta} →</a>
    </article>
  );
}
