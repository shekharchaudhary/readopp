"use client";

import { useState } from "react";
import type { EvidenceMap } from "@/lib/shared/schemas";

export function EvidenceInspector({ evidence }: { evidence: EvidenceMap }) {
  const [open, setOpen] = useState(false);
  const ungrounded = evidence.panels.filter((panel) => !panel.grounded).length;
  const healthy = evidence.coveragePercent >= 70 && ungrounded === 0;
  return (
    <section className="rounded-xl border border-paper-line bg-paper-soft p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
        <span>
          <span className="block text-sm font-semibold text-ink">Source fidelity</span>
          <span className="mt-1 block text-xs text-ink-muted">
            {evidence.coveredClaimCount}/{evidence.claimCount} source claims used · {ungrounded === 0 ? "every panel is grounded" : `${ungrounded} panel${ungrounded === 1 ? "" : "s"} need evidence`}
          </span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${healthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          {evidence.coveragePercent}%
        </span>
      </button>
      {open && (
        <div className="mt-4 grid gap-2 border-t border-paper-line pt-4">
          {evidence.panels.map((panel, index) => (
            <div key={panel.sectionId} className="rounded-lg bg-surface px-3 py-2.5">
              <p className="text-xs font-semibold text-ink">{index + 1}. {panel.heading}</p>
              {panel.claims.length > 0 ? panel.claims.map((claim) => <p key={claim} className="mt-1 text-xs leading-5 text-ink-muted">↳ {claim}</p>) : <p className="mt-1 text-xs text-amber-800">No explicit source claim mapped to this panel.</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
