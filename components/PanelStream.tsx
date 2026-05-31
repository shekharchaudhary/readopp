"use client";

import { PanelCard } from "./PanelCard";
import type { PanelSlot } from "@/lib/scene/reducer";

interface Props {
  slots: PanelSlot[];
  onExportPanel?: (sectionId: string) => void;
}

export function PanelStream({ slots, onExportPanel }: Props) {
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
              onExport={onExportPanel}
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
      <div className="border-b border-paper-line px-5 py-4">
        <div className="text-[11px] text-ink-faint tabular-nums">
          {String(index).padStart(2, "0")}
        </div>
        <div className="mt-2 h-5 w-1/2 motion-safe:animate-pulse rounded bg-paper-soft" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-44 motion-safe:animate-pulse rounded bg-paper-soft" />
        <div className="h-3 w-3/4 motion-safe:animate-pulse rounded bg-paper-soft" />
      </div>
    </article>
  );
}
