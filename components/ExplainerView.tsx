"use client";

import { useState } from "react";
import { ExportSheet } from "./ExportSheet";
import { PanelCard } from "./PanelCard";
import type { Explainer } from "@/lib/shared/schemas";

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface Props {
  explainer: Explainer;
  canExport?: boolean;
}

export function ExplainerView({ explainer, canExport = true }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPanelId, setExportPanelId] = useState<string | undefined>(
    undefined
  );
  const [copied, setCopied] = useState(false);

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
            <a
              href={explainer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {sourceDomain(explainer.url)}
            </a>
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
          />
        ))}
      </section>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        explainerId={explainer.id}
        panelId={exportPanelId}
      />
    </div>
  );
}
