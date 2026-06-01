import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

const FAQS = [
  {
    q: "What kinds of articles work best?",
    a: "Focused, technical writing with a clear argument — blog posts, research papers, launch notes, deep newsletters. Long-form pieces that already have structure translate best into panels. Listicles and news roundups translate less well.",
  },
  {
    q: "How long does it take?",
    a: "About sixty to ninety seconds for the explainer to generate, and another twenty-five to thirty-five seconds if you export the animated MP4. You watch the agents work in real time, so the wait isn't blind.",
  },
  {
    q: "Will it pull paywalled or login-required articles?",
    a: "No. Readopp fetches public HTML the same way a browser would. If the page is behind a paywall, login, or aggressive bot wall, the read step will fail clearly and you can pick a different source.",
  },
  {
    q: "Can I edit the panels?",
    a: "Not yet in the UI. Every export is regenerable, and the heading and caption text comes directly from the article's structure — so if the model gets something wrong, re-running with a different audience level usually fixes it.",
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
    <section id="faq" className="border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-4xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="04" title="Questions" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            The questions people ask first.
          </h2>
        </Reveal>

        <div className="mt-14 divide-y divide-paper-line border-y border-paper-line">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delayMs={i * 40}>
              <details className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
                  <span className="text-base font-medium text-ink sm:text-lg">
                    {f.q}
                  </span>
                  <Chevron />
                </summary>
                <p className="mt-3 max-w-[64ch] pr-10 text-base leading-relaxed text-ink-soft">
                  {f.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-ink-muted transition-transform group-open:rotate-180 group-open:text-ink"
    >
      <svg viewBox="0 0 12 12" width="11" height="11">
        <path
          d="M2.5 4.5 L6 8 L9.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
