"use client";

import { useEffect, useRef, useState } from "react";
import type { PreparedTextWithSegments } from "@chenglou/pretext";

const COPY = "Every useful story starts with a spark. A question, a paragraph, a detail you want to remember. Give that idea space to move. Connect the dots, find your angle, and turn a good read into something worth sharing.";
const SVG_NS = "http://www.w3.org/2000/svg";

export function PretextMotionPreview() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [width, setWidth] = useState(490);
  const svg = useRef<SVGSVGElement>(null);
  const lines = useRef<SVGGElement>(null);
  const shape = useRef<SVGCircleElement>(null);
  const prepared = useRef<PreparedTextWithSegments | null>(null);
  const engine = useRef<typeof import("@chenglou/pretext") | null>(null);
  const phase = useRef(0);
  const fontFamily = useRef("system-ui, sans-serif");

  useEffect(() => {
    let cancelled = false;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(preference.matches); if (preference.matches) setPlaying(false); };
    update(); preference.addEventListener("change", update);
    async function prepare() {
      try {
        const module = await import("@chenglou/pretext");
        await document.fonts.ready;
        if (cancelled || !svg.current) return;
        fontFamily.current = getComputedStyle(svg.current).fontFamily;
        prepared.current = module.prepareWithSegments(COPY, `22px ${fontFamily.current}`);
        engine.current = module;
        setReady(true);
      } catch { if (!cancelled) setFailed(true); }
    }
    void prepare();
    return () => { cancelled = true; preference.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (!ready || !prepared.current || !engine.current || !lines.current) return;
    const group = lines.current;
    const nodes: SVGTextElement[] = [];
    group.replaceChildren();
    let frame = 0;
    let previous = 0;
    function draw(time: number) {
      if (!prepared.current || !engine.current) return;
      if (playing && !document.hidden) {
        if (previous) phase.current += Math.min(time - previous, 50) / 1000;
        previous = time;
      } else previous = 0;
      const centerX = 40 + width - 30;
      const centerY = 176 + Math.sin(phase.current * 1.25) * 85;
      const radius = 43;
      shape.current?.setAttribute("cx", String(centerX));
      shape.current?.setAttribute("cy", String(centerY));
      let cursor = { segmentIndex: 0, graphemeIndex: 0 };
      let count = 0;
      for (let y = 85; y <= 465; y += 29) {
        const distance = Math.max(0, Math.abs(y - 8 - centerY) - 15);
        const available = distance < radius + 12
          ? Math.max(120, width - 30 - Math.sqrt(Math.max(0, (radius + 12) ** 2 - distance ** 2)))
          : width;
        const line = engine.current.layoutNextLine(prepared.current, cursor, available);
        if (!line) break;
        let node = nodes[count];
        if (!node) {
          node = document.createElementNS(SVG_NS, "text");
          node.setAttribute("x", "40"); node.setAttribute("font-size", "22");
          node.setAttribute("font-family", fontFamily.current);
          nodes.push(node); group.appendChild(node);
        }
        node.setAttribute("y", String(y));
        node.textContent = line.text;
        node.style.display = "";
        cursor = line.end; count += 1;
      }
      for (let index = count; index < nodes.length; index += 1) nodes[index].style.display = "none";
      if (playing) frame = requestAnimationFrame(draw);
    }
    draw(performance.now());
    return () => { cancelAnimationFrame(frame); group.replaceChildren(); };
  }, [playing, ready, width]);

  return <section id="text-motion" className="pretext-preview mb-12 rounded-2xl border border-paper-line bg-surface p-5 sm:p-7" aria-labelledby="text-motion-title">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Live typography</p><h2 id="text-motion-title" className="mt-2 text-xl font-medium tracking-tight text-ink">See your words make room for an idea.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">Press play to watch the text flow around a moving shape. Adjust the width to try a different composition.</p></div><button type="button" className="site-action shrink-0 rounded-xl bg-ink px-4 py-3 text-xs font-medium text-paper disabled:opacity-50" disabled={!ready || reduced} aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? "Pause animation" : "Play animation"}</button></div>
    <div className="force-light mt-5 overflow-hidden rounded-xl border border-paper-line bg-[#faf9f5]">
      <svg ref={svg} viewBox="0 0 640 500" className="block h-auto w-full font-sans" aria-hidden="true" data-pretext-preview><text x="40" y="35" fontSize="10" fill="#7a7469" letterSpacing="2">FROM READING TO CREATING</text><circle ref={shape} cx="500" cy="176" r="43" fill="#cce68a" stroke="#a9c769" strokeWidth="1" /><g ref={lines} fill="#30362a" />{!ready && <text x="40" y="90" fontSize="17" fill="#666">{failed ? "The text preview could not load." : "Preparing your text preview…"}</text>}</svg>
    </div>
    <p className="sr-only">{COPY}</p>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"><label htmlFor="text-motion-width" className="shrink-0 text-xs text-ink-soft">Text width <span className="font-mono text-ink-muted">{width} px</span></label><input id="text-motion-width" type="range" min="260" max="540" step="10" value={width} disabled={!ready} onChange={event => setWidth(Number(event.target.value))} className="min-w-0 flex-1 accent-[#7eae3f]" /><span role="status" className="text-[10px] text-ink-muted">{reduced ? "Motion is off for your device. Try the width control." : playing ? "Playing · Pretext text layout" : "Paused · Pretext text layout"}</span></div>
  </section>;
}
