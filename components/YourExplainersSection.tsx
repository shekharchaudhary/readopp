"use client";

import { useEffect, useState } from "react";
import { ExampleGallery } from "./ExampleGallery";

/**
 * Personalised "Your explainers" / "What others have made" section.
 *
 * Polls /api/explainers once to decide which mode to render:
 *   - hasItems  : show the user's own recent runs ("Your explainers")
 *   - !hasItems : show the curated sample gallery instead
 *                ("What others have made"), pulling from the
 *                /api/explainers/samples endpoint. First-time visitors
 *                used to see no section at all here — empty silence
 *                isn't as compelling as 2-3 polished demo explainers.
 *   - loading   : render nothing (the brief flash of "What others have
 *                made" would otherwise show even for return users).
 */
export function YourExplainersSection() {
  const [hasItems, setHasItems] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explainers", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setHasItems(Array.isArray(data.explainers) && data.explainers.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hasItems === null) return null;

  const isSamples = !hasItems;

  return (
    <section id="library" className="force-light border-b border-[#e8e8e8] bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[.65fr_1.35fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7eae3f]">
              {isSamples ? "From the reading room" : "Your reading room"}
            </p>
            <h2 className="mt-5 max-w-lg font-sans text-5xl font-bold leading-[.98] tracking-[-.05em] text-[#484848]">
              {isSamples
                ? <>Made from writing<br /><em>worth revisiting.</em></>
                : <>Your saved<br /><em>visual notes.</em></>}
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-[#686868]">
              {isSamples
                ? "Open an example to read the complete sequence and see how the original source holds together."
                : "Sign in with Google to keep them attached across devices. Click any to revisit, edit, or re-export."}
            </p>
          </div>
          <div>
            <ExampleGallery
              source={
                isSamples ? "/api/explainers/samples" : "/api/explainers"
              }
              showDelete={!isSamples}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
