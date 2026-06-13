import Link from "next/link";
import { KnotArrow } from "./KnotArrow";
import { Reveal } from "./Reveal";
import { Squiggle } from "./Squiggle";

/**
 * Bottom-of-page closer. Same "I've read everything, now what?" anchor
 * pattern as the Napkin landing — decorative downward arrow, oversized
 * headline, reassuring micro-line, single dark button — but Readopp's
 * own voice and copy. Sends the user back to the hero form via #try
 * so the action is a single intra-page jump, not a route change.
 */
export function FinalCTA() {
  return (
    <section className="force-light relative isolate overflow-hidden bg-dark">
      {/* Warm bloom so the dark closer doesn't read flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 0%, rgb(var(--c-mint) / 0.10), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-5xl px-6 pb-28 pt-20 text-center sm:pb-36 sm:pt-28">
        <Reveal>
          <KnotArrow />
        </Reveal>

        <Reveal delayMs={120}>
          <h2 className="mt-8 font-display text-4xl font-medium leading-[1.05] tracking-tight text-paper sm:text-5xl lg:text-[64px]">
            Turn your next read into a{" "}
            <Squiggle className="[--squiggle:rgb(var(--c-mint))]">post</Squiggle>.
          </h2>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="mx-auto mt-5 max-w-xl text-base text-paper-line sm:text-lg">
            Paste a URL. Pick a template. Hit Explain. The whole thing takes
            less than a coffee.
          </p>
        </Reveal>

        <Reveal delayMs={280}>
          <div className="mt-9 flex flex-col items-center gap-3">
            <Link href="#try" className="btn-mint btn-lg group">
              Generate your first carousel
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <p className="text-[13px] text-paper-line/70">
              3 free posts · no credit card · works with any URL or PDF
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

