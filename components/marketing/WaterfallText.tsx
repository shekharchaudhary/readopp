"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** Per-word falling letters, with Pretext widths pacing the cascade. */
export function WaterfallText({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  const enabled = useRef(false);
  const delays = useRef<number[][]>([]);
  const animations = useRef(new Set<Animation>());
  const active = useRef(new Map<HTMLElement, Animation>());
  const words = text.split(" ");

  const stop = () => { animations.current.forEach(animation => animation.cancel()); animations.current.clear(); active.current.clear(); };
  useEffect(() => {
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover:hover) and (pointer:fine)");
    const update = () => { enabled.current = !reduced.matches && fine.matches; if (!enabled.current) stop(); };
    update(); reduced.addEventListener("change", update); fine.addEventListener("change", update);
    async function measure() {
      try {
        const pretext = await import("@chenglou/pretext");
        await document.fonts.ready;
        if (cancelled || !root.current) return;
        const style = getComputedStyle(root.current);
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const widths = new Map<string, number>();
        delays.current = text.split(" ").map(word => {
          const measured = Array.from(word).map(letter => {
            if (!widths.has(letter)) widths.set(letter, pretext.measureNaturalWidth(pretext.prepareWithSegments(letter, font)));
            return widths.get(letter)!;
          });
          const total = measured.reduce((sum, width) => sum + width, 0) || 1;
          let offset = 0;
          return measured.map(width => { const delay = offset / total * 190; offset += width; return delay; });
        });
        root.current.dataset.pretextWaterfall = "ready";
      } catch { /* Text and a simple timing fallback remain available. */ }
    }
    void measure();
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { cancelled = true; stop(); reduced.removeEventListener("change", update); fine.removeEventListener("change", update); document.removeEventListener("visibilitychange", hide); };
  }, [text]);

  function cascade(event: PointerEvent<HTMLSpanElement>, wordIndex: number) {
    if (!enabled.current || event.pointerType !== "mouse") return;
    const glyphs = event.currentTarget.querySelectorAll<HTMLElement>("[data-waterfall-glyph]");
    glyphs.forEach((glyph, index) => {
      active.current.get(glyph)?.cancel();
      const animation = glyph.animate([
        { transform: "translateY(0) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: "translateY(32px) rotate(5deg)", opacity: .1, offset: .38 },
        { transform: "translateY(34px) rotate(5deg)", opacity: 0, offset: .4 },
        { transform: "translateY(-10px) rotate(-2deg)", opacity: 0, offset: .41 },
        { transform: "translateY(0) rotate(0deg)", opacity: 1, offset: 1 },
      ], { duration: 650, delay: delays.current[wordIndex]?.[index] ?? index * 25, easing: "cubic-bezier(.4,0,.2,1)" });
      animations.current.add(animation); active.current.set(glyph, animation);
      const release = () => { animations.current.delete(animation); if (active.current.get(glyph) === animation) active.current.delete(glyph); };
      animation.onfinish = release; animation.oncancel = release;
    });
  }

  return <p ref={root} className={className} data-pretext-waterfall="loading" onPointerLeave={stop}>
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{words.map((word, wordIndex) => <span key={`${wordIndex}-${word}`}>{wordIndex > 0 ? " " : null}<span className="waterfall-word" data-waterfall-word onPointerEnter={event => cascade(event, wordIndex)}>{Array.from(word).map((letter,index)=><span className="waterfall-glyph" data-waterfall-glyph key={index}>{letter}</span>)}</span></span>)}</span>
  </p>;
}
