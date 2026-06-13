"use client";

import { useEffect, useState } from "react";
import { ExampleGallery } from "./ExampleGallery";
import { Reveal } from "./marketing/Reveal";
import { SectionLabel } from "./marketing/SectionLabel";

/**
 * Personalised "Your explainers" section. Hides itself entirely when the
 * current user has zero explainers — a brand-new visitor sees no empty
 * shell. Once they generate one, the section appears below the hero.
 *
 * Polls /api/explainers once to decide visibility, then renders the shared
 * ExampleGallery (which does its own fetch — the duplicate is cheap and
 * keeps the two concerns decoupled).
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

  if (hasItems !== true) return null;

  // Sage is a deliberate one-off: the user asked for this section to break
  // from the site palette entirely, so the island is pinned light and green
  // in both themes.
  return (
    <section className="border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="force-light rounded-3xl bg-sage-soft px-6 py-16 sm:px-12 sm:py-20">
          <Reveal>
            <SectionLabel title="Your explainers" tone="sage" />
          </Reveal>
          <Reveal delayMs={60}>
            <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
              Everything you&rsquo;ve made with Readopp.
            </h2>
          </Reveal>
          <Reveal delayMs={120}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
              Sign in with Google to keep them attached across devices. Click
              any to revisit, edit, or re-export.
            </p>
          </Reveal>
          <div className="mt-12">
            <ExampleGallery />
          </div>
        </div>
      </div>
    </section>
  );
}
