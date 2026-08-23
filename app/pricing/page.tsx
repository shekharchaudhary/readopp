import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/Footer";
import { Nav } from "@/components/marketing/Nav";

export const metadata: Metadata = {
  title: "Pricing — Readopp",
  description: "Start creating visual stories with Readopp for free, then upgrade when publishing becomes a weekly habit.",
};

export default function PricingPage() {
  return (
    <div className="force-light min-h-screen bg-[#f2ebf7] text-[#484848]">
      <Nav />
      <main className="pricing-stage overflow-hidden">
        <section className="relative mx-auto max-w-[1080px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-20">
            <div className="max-w-[430px]">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#9b64b5]">Pricing</p>
              <h1 className="mt-4 text-4xl font-bold tracking-[-.05em] text-[#484848] sm:text-6xl">
                Start free.<br />Pay when it sticks.
              </h1>
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
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.035em]">A steady publishing practice</h2>
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
                    <span key={week} className="cadence-week" style={{ "--week": index } as CSSProperties}>
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

              <Link href="/#try" className="pricing-cta mt-7 flex items-center justify-between rounded-2xl bg-[#cce68a] px-5 py-4 text-sm font-bold text-[#484848] transition-colors hover:bg-[#d8ef9d]">
                <span>Choose Author</span>
                <span aria-hidden className="pricing-arrow text-lg">→</span>
              </Link>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
