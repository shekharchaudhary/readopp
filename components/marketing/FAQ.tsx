const FAQS = [
  {
    q: "What kinds of articles work best?",
    a: "Focused, technical writing with a clear argument — blog posts, research papers, launch notes, deep newsletters. Long-form pieces that already have structure translate best into panels. Listicles and news roundups translate less well.",
  },
  {
    q: "How long does it take?",
    a: "About sixty to ninety seconds for the visual story to generate, and another twenty-five to thirty-five seconds if you export an animated MP4. Progress stays visible while the source is being read and composed.",
  },
  {
    q: "Will it pull paywalled or login-required articles?",
    a: "No. Readopp fetches public HTML the same way a browser would. If the page is behind a paywall, login, or aggressive bot wall, the read step will fail clearly and you can pick a different source.",
  },
  {
    q: "Can I edit the result?",
    a: "Yes. You can revise the copy, adjust the visual treatment, reorder panels, and regenerate individual parts without rebuilding the whole story.",
  },
  {
    q: "What's in the exported MP4?",
    a: "A short title scene, one scene per panel with animated draw-in and captions, and an outro frame with a QR code that links back to the full explainer. No music, no voiceover — clean enough to drop into Reels or TikTok and overlay your own.",
  },
  {
    q: "Is it free?",
    a: "For now, yes. Readopp is in early development and the host pays the model costs. Expect a fair-use limit and an optional paid tier soon.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="force-light border-b border-[#e8e8e8] bg-white">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.65fr_1.35fr] lg:gap-20 lg:px-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#3da9d8]">Questions, answered</p>
          <h2 className="mt-5 font-sans text-5xl font-bold leading-none tracking-[-.05em] text-[#484848]">Before you<br /><span className="text-[#3da9d8]">begin.</span></h2>
        </div>
        <div className="border-t border-[#484848]">
          {FAQS.map((f, i) => (
              <details key={f.q} className="group border-b border-[#e8e8e8] py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
                  <span className="flex items-baseline gap-4 text-base font-bold text-[#484848] sm:text-lg"><span className="text-[10px] font-normal text-[#999]">0{i + 1}</span>{f.q}</span>
                  <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf6fc] text-lg font-light text-[#3da9d8] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-[64ch] pl-10 pr-10 text-base leading-relaxed text-[#686868] group-open:animate-rise-in">
                  {f.a}
                </p>
              </details>
          ))}
        </div>
      </div>
    </section>
  );
}
