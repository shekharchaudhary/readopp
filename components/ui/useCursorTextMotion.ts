"use client";
import { useEffect, useRef, type RefObject, type PointerEvent } from "react";
type Glyph = { element: HTMLElement; cx: number; cy: number; x: number; y: number; angle: number };
export function useCursorTextMotion<T extends HTMLElement>(root: RefObject<T>, selector = "[data-cursor-glyph]", lift = 3, radius = 60) {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const enabled = useRef(false);
  const wake = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let glyphs: Glyph[] = [];
    let measured = false;
    let frame = 0;
    let previous = 0;
    function reset() {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      pointer.current = null; measured = false;
      for (const glyph of glyphs) glyph.element.style.removeProperty("transform");
      glyphs = [];
    }
    function updatePreference() {
      enabled.current = !preference.matches && finePointer.matches;
      reset();
    }
    function measure() {
      // Read positions once per entry/resize, never during the animation loop.
      glyphs = Array.from(element!.querySelectorAll<HTMLElement>(selector)).map(node => {
        const rect = node.getBoundingClientRect();
        return { element: node, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, x: 0, y: 0, angle: 0 };
      });
      measured = true;
    }
    function animate(time: number) {
      const ease = previous ? 1 - Math.exp(-Math.min(time - previous, 50) / 65) : .2;
      previous = time;
      let moving = false;
      const point = pointer.current;
      for (const glyph of glyphs) {
        const dx = point ? glyph.cx - point.x : 0;
        const dy = point ? glyph.cy - point.y : 0;
        const influence = point ? Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius)) : 0;
        const targetX = Math.max(-3, Math.min(3, dx * .025)) * influence;
        const targetY = -lift * influence;
        const targetAngle = Math.max(-2, Math.min(2, dx * .025)) * influence;
        glyph.x += (targetX - glyph.x) * ease;
        glyph.y += (targetY - glyph.y) * ease;
        glyph.angle += (targetAngle - glyph.angle) * ease;
        if (Math.abs(glyph.x - targetX) + Math.abs(glyph.y - targetY) + Math.abs(glyph.angle - targetAngle) > .025) moving = true;
        if (!point && Math.abs(glyph.x) + Math.abs(glyph.y) + Math.abs(glyph.angle) < .025) glyph.element.style.removeProperty("transform");
        else glyph.element.style.transform = `translate3d(${glyph.x.toFixed(3)}px,${glyph.y.toFixed(3)}px,0) rotate(${glyph.angle.toFixed(3)}deg)`;
      }
      if (moving) frame = requestAnimationFrame(animate);
      else { frame = 0; previous = 0; }
    }
    wake.current = () => {
      if (!enabled.current) return;
      if (!measured) measure();
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const invalidate = () => reset();
    const resize = new ResizeObserver(invalidate);
    resize.observe(element);
    const content = new MutationObserver(invalidate);
    content.observe(element, { childList: true, subtree: true });
    preference.addEventListener("change", updatePreference);
    finePointer.addEventListener("change", updatePreference);
    window.addEventListener("scroll", invalidate, { passive: true });
    updatePreference();
    return () => { reset(); wake.current = null; resize.disconnect(); content.disconnect(); preference.removeEventListener("change", updatePreference); finePointer.removeEventListener("change", updatePreference); window.removeEventListener("scroll", invalidate); };
  }, [root, selector, lift, radius]);

  return {
    onPointerMove: (event: PointerEvent<T>) => { if (!enabled.current || event.pointerType !== "mouse") return; pointer.current = { x: event.clientX, y: event.clientY }; wake.current?.(); },
    onPointerLeave: () => { pointer.current = null; wake.current?.(); },
  };
}
