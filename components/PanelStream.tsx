"use client";

import { PanelCard } from "./PanelCard";
import type { PanelSlot } from "@/lib/scene/reducer";

export function PanelStream({ slots }: { slots: PanelSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <section className="space-y-6">
      {slots.map((slot) => {
        if (slot.panel) {
          return (
            <PanelCard
              key={slot.sectionId ?? `slot-${slot.index}`}
              panel={slot.panel}
              index={slot.index - 1}
            />
          );
        }
        return <SkeletonCard key={`slot-${slot.index}`} index={slot.index} />;
      })}
    </section>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <article
      className="rounded-lg border border-paper-line bg-white"
      aria-busy="true"
    >
      <div className="border-b border-paper-line px-4 py-2 text-xs uppercase tracking-wide text-ink-muted">
        Panel {index}
      </div>
      <div className="space-y-3 p-4">
        <div className="h-3 w-2/5 motion-safe:animate-pulse rounded bg-paper-soft" />
        <div className="h-44 motion-safe:animate-pulse rounded bg-paper-soft" />
        <div className="h-3 w-3/4 motion-safe:animate-pulse rounded bg-paper-soft" />
      </div>
    </article>
  );
}
