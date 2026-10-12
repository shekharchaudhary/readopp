"use client";

import { MARKETING_COPY } from "@/lib/marketingCopy";
import { useRef } from "react";
import { useCursorTextMotion } from "@/components/ui/useCursorTextMotion";

const FIRST = MARKETING_COPY.headlineFirst;
const SECOND = MARKETING_COPY.headlineSecond;

function Words({ text }: { text: string }) {
  return <>{text.split(" ").map((word, index) => <span key={`${index}-${word}`}>{index > 0 ? " " : null}<span className="cursor-headline-word">{Array.from(word).map((letter, position) => <span key={position} data-headline-glyph className="cursor-headline-glyph">{letter}</span>)}</span></span>)}</>;
}

export function CursorHeadline() {
  const heading = useRef<HTMLHeadingElement>(null);
  const motion = useCursorTextMotion(heading, "[data-headline-glyph]", 7, 85);

  return <h1 ref={heading} className="cursor-headline landing-enter landing-enter-2 mx-auto mt-7 max-w-[900px] font-sans text-[48px] font-bold leading-[1.01] tracking-[-.058em] text-ink sm:text-[72px] lg:text-[86px]"
    {...motion}>
    <span className="sr-only">{FIRST} {SECOND}</span>
    <span aria-hidden="true"><Words text={FIRST} /><span className="relative mx-auto block w-fit landing-green"><Words text={SECOND} /><svg aria-hidden className="hero-squiggle absolute -bottom-3 left-0 h-4 w-full" viewBox="0 0 500 20" preserveAspectRatio="none"><path d="M5 12 C95 2, 165 18, 250 9 S405 4, 495 12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></span></span>
  </h1>;
}
