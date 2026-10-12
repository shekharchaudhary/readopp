"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A cursor-following ink highlight; glyphs keep their normal positions. */
export function WorkflowTextRegion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);
  const positions = useRef<Array<{ element: HTMLElement; left: number; top: number }>>([]);
  const frame = useRef(0);
  const point = useRef({ x: 0, y: 0 });
  const reset = () => { cancelAnimationFrame(frame.current); frame.current = 0; root.current?.removeAttribute("data-ink-active"); positions.current = []; };
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover:hover) and (pointer:fine)");
    const update = () => { enabled.current = !reduce.matches && fine.matches; reset(); };
    const resize = new ResizeObserver(reset);
    if (root.current) resize.observe(root.current);
    update(); reduce.addEventListener("change", update); fine.addEventListener("change", update);
    window.addEventListener("scroll", reset, { passive: true });
    return () => { reset(); resize.disconnect(); reduce.removeEventListener("change", update); fine.removeEventListener("change", update); window.removeEventListener("scroll", reset); };
  }, []);
  return <div ref={root} className="workflow-text-region max-w-[430px]" onPointerLeave={reset} onPointerMove={event => {
    if (!enabled.current || event.pointerType !== "mouse" || !root.current) return;
    if (!positions.current.length) positions.current = Array.from(root.current.querySelectorAll<HTMLElement>("[data-workflow-ink]")).map(element => { const box = element.getBoundingClientRect(); return { element, left: box.left, top: box.top }; });
    point.current = { x: event.clientX, y: event.clientY };
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0; root.current?.setAttribute("data-ink-active", "true");
      for (const position of positions.current) { position.element.style.setProperty("--ink-x", `${point.current.x - position.left}px`); position.element.style.setProperty("--ink-y", `${point.current.y - position.top}px`); }
    });
  }}>{children}</div>;
}

/** Pretext measures word widths once to pace the selection reveal across a title. */
export function WorkflowRevealText({ text, active }: { text: string; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const words = text.split(" ");
  const [delays, setDelays] = useState<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function measure() {
      try {
        const pretext = await import("@chenglou/pretext");
        await document.fonts.ready;
        if (cancelled || !ref.current) return;
        const font = getComputedStyle(ref.current);
        const widths = text.split(" ").map(word => pretext.measureNaturalWidth(pretext.prepareWithSegments(word, `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`)));
        const total = widths.reduce((sum, width) => sum + width, 0) || 1;
        let offset = 0;
        setDelays(widths.map(width => { const delay = offset / total * 160; offset += width; return delay; }));
      } catch { /* Static typography remains usable if measurement is unavailable. */ }
    }
    void measure(); return () => { cancelled = true; };
  }, [text]);
  return <span ref={ref} data-pretext-paced={delays.length > 0 ? "true" : "false"}><span className="sr-only">{text}</span><span aria-hidden="true">{words.map((word,index)=><span key={index}>{index > 0 ? " " : null}<span className={active ? "workflow-reveal-word is-selected" : "workflow-reveal-word"} style={{ transitionDelay: `${delays[index] ?? index * 40}ms` }}>{word}</span></span>)}</span></span>;
}
