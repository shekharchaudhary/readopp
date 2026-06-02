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

  return (
    <section className="border-b border-paper-line bg-white">
      <div className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="03" title="Your explainers" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
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
    </section>
  );
}
