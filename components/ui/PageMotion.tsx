"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Progressive enhancement: content stays visible without JavaScript or motion. */
export function PageMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const selector = "main h1, main h2, [data-motion-item]";
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (preference.matches || entry.target.closest(".excalidraw")) continue;
        // Opacity only: transformed ancestors can break fixed editor dialogs.
        const animation = entry.target.animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 420, easing: "cubic-bezier(.22,1,.36,1)",
        });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0.08 });
    function watch(root: Element) {
      const elements = root.matches(selector) ? [root, ...root.querySelectorAll(selector)] : [...root.querySelectorAll(selector)];
      for (const element of elements) {
        if (!seen.has(element)) { seen.add(element); observer.observe(element); }
      }
    }
    watch(document.body);
    const changes = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && !node.closest(".excalidraw")) watch(node);
      }
    });
    changes.observe(document.body, { childList: true, subtree: true });
    const stopMotion = () => { if (preference.matches) { animations.forEach(animation => animation.cancel()); animations.clear(); } };
    preference.addEventListener("change", stopMotion);
    return () => { observer.disconnect(); changes.disconnect(); animations.forEach(animation => animation.cancel()); preference.removeEventListener("change", stopMotion); };
  }, [pathname]);
  return null;
}
