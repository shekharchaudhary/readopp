"use client";

import { useState } from "react";
import { ExportSheet } from "./ExportSheet";
import { PanelCard } from "./PanelCard";
import type { Explainer } from "@/lib/shared/schemas";
import { sourceIsLinkable, sourceLabel } from "@/lib/shared/source";

interface Props {
  explainer: Explainer;
  canExport?: boolean;
}

export function ExplainerView({ explainer: initial, canExport = true }: Props) {
  const [explainer, setExplainer] = useState<Explainer>(initial);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPanelId, setExportPanelId] = useState<string | undefined>(
    undefined
  );
  const [copied, setCopied] = useState(false);

  async function patchPanel(
    sectionId: string,
    patch: { heading?: string; caption?: string; content?: string }
  ) {
    const res = await fetch(
      `/api/explainers/${explainer.id}/panels/${sectionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
    if (data.explainer) setExplainer(data.explainer as Explainer);
  }

  async function resetPanel(sectionId: string) {
    const res = await fetch(
      `/api/explainers/${explainer.id}/panels/${sectionId}/reset`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Reset failed (${res.status})`);
    if (data.explainer) setExplainer(data.explainer as Explainer);
  }

  function openExportAll() {
    setExportPanelId(undefined);
    setExportOpen(true);
  }
  function openExportPanel(sectionId: string) {
    setExportPanelId(sectionId);
    setExportOpen(true);
  }

  async function copyLink() {
    try {
      const url = `${window.location.origin}/e/${explainer.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers without clipboard API
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            {explainer.title}
          </h1>
          <p className="text-sm text-ink-muted">
            {sourceIsLinkable(explainer.url) ? (
              <a
                href={explainer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {sourceLabel(explainer.url)}
              </a>
            ) : (
              <span>{sourceLabel(explainer.url)}</span>
            )}
            <span className="mx-2">·</span>
            <span>audience: {explainer.audienceLevel}</span>
          </p>
          {explainer.summary && (
            <p className="max-w-2xl text-base text-ink-soft">
              {explainer.summary}
            </p>
          )}
        </div>
        {canExport && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={openExportAll}
              className="rounded-md border border-paper-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
            >
              Export all
            </button>
          </div>
        )}
      </header>

      <section className="space-y-6">
        {explainer.panels.map((panel, i) => (
          <PanelCard
            key={panel.sectionId}
            panel={panel}
            index={i}
            onExport={canExport ? openExportPanel : undefined}
            onEdit={canExport ? patchPanel : undefined}
            onReset={canExport ? resetPanel : undefined}
          />
        ))}
      </section>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        explainerId={explainer.id}
        panelId={exportPanelId}
        socialPack={explainer.socialPack}
        onSocialPackChange={(next) => setExplainer(next)}
      />
    </div>
  );
}
