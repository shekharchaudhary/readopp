"use client";

import { useState } from "react";
import { ExportSheet } from "./ExportSheet";
import { PanelCard } from "./PanelCard";
import { TemplatePicker } from "./TemplatePicker";
import type { Explainer, TemplateId } from "@/lib/shared/schemas";
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

  /**
   * Optimistically commit a panel reorder and persist via the API. On
   * server failure, revert to the previous order so the UI never drifts
   * from server truth.
   */
  async function reorderPanels(order: string[]) {
    const previous = explainer.panels;
    const byId = new Map(previous.map((p) => [p.sectionId, p]));
    const next = order.map((id) => byId.get(id)).filter(Boolean) as typeof previous;
    if (next.length !== previous.length) return;
    setExplainer({ ...explainer, panels: next });
    try {
      const res = await fetch(
        `/api/explainers/${explainer.id}/panels/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Reorder failed (${res.status})`);
      if (data.explainer) setExplainer(data.explainer as Explainer);
    } catch (e) {
      setExplainer({ ...explainer, panels: previous });
      window.alert((e as Error).message);
    }
  }

  async function deletePanel(sectionId: string) {
    if (explainer.panels.length <= 1) {
      window.alert("An explainer needs at least one panel.");
      return;
    }
    const panel = explainer.panels.find((p) => p.sectionId === sectionId);
    const label = panel?.heading?.trim() || "this panel";
    if (
      !window.confirm(
        `Delete "${label}"? This can't be undone.`
      )
    ) {
      return;
    }
    const previous = explainer.panels;
    setExplainer({
      ...explainer,
      panels: previous.filter((p) => p.sectionId !== sectionId),
    });
    try {
      const res = await fetch(
        `/api/explainers/${explainer.id}/panels/${sectionId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`);
      if (data.explainer) setExplainer(data.explainer as Explainer);
    } catch (e) {
      setExplainer({ ...explainer, panels: previous });
      window.alert((e as Error).message);
    }
  }

  async function insertBlankPanel(afterSectionId?: string) {
    try {
      const res = await fetch(
        `/api/explainers/${explainer.id}/panels/insert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(afterSectionId ? { afterSectionId } : {}),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Insert failed (${res.status})`);
      if (data.explainer) setExplainer(data.explainer as Explainer);
    } catch (e) {
      window.alert((e as Error).message);
    }
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
              className="rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <TemplatePicker
              explainerId={explainer.id}
              current={explainer.template}
              onChange={(next: TemplateId) =>
                setExplainer({ ...explainer, template: next })
              }
            />
            <button
              type="button"
              onClick={openExportAll}
              className="rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
            >
              Export all
            </button>
          </div>
        )}
      </header>

      <section className="space-y-3">
        {canExport && (
          <InsertSlot
            label="Add panel above"
            onInsert={() => insertBlankPanel(undefined)}
          />
        )}
        {explainer.panels.map((panel, i) => (
          <div key={panel.sectionId}>
            <PanelDraggable
              panelId={panel.sectionId}
              index={i}
              draggable={canExport && explainer.panels.length > 1}
              onReorder={reorderPanels}
              order={explainer.panels.map((p) => p.sectionId)}
            >
              <PanelCard
                panel={panel}
                index={i}
                onExport={canExport ? openExportPanel : undefined}
                onEdit={canExport ? patchPanel : undefined}
                onReset={canExport ? resetPanel : undefined}
                onDelete={canExport ? deletePanel : undefined}
                canDelete={canExport && explainer.panels.length > 1}
                explainerId={explainer.id}
                template={explainer.template}
              />
            </PanelDraggable>
            {canExport && (
              <InsertSlot
                label="Add panel below"
                onInsert={() => insertBlankPanel(panel.sectionId)}
              />
            )}
          </div>
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

/**
 * HTML5 drag-and-drop wrapper for a panel card. Each draggable uses
 * dataTransfer to ship the source sectionId; dragover on a peer card
 * marks it as a drop target, drop computes the new order and calls
 * onReorder. The native API is fine here — no kbd a11y story yet, but
 * the buttons below ("Move up / down") cover keyboard users.
 */
function PanelDraggable({
  children,
  panelId,
  index,
  draggable,
  order,
  onReorder,
}: {
  children: React.ReactNode;
  panelId: string;
  index: number;
  draggable: boolean;
  order: string[];
  onReorder: (next: string[]) => void;
}) {
  const [over, setOver] = useState<"top" | "bottom" | null>(null);

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/x-readopp-panel", panelId);
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("text/x-readopp-panel")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isTop = e.clientY < rect.top + rect.height / 2;
    setOver(isTop ? "top" : "bottom");
  }
  function handleDragLeave() {
    setOver(null);
  }
  function handleDrop(e: React.DragEvent) {
    const sourceId = e.dataTransfer.getData("text/x-readopp-panel");
    setOver(null);
    if (!sourceId || sourceId === panelId) return;
    e.preventDefault();
    const sourceIndex = order.indexOf(sourceId);
    if (sourceIndex < 0) return;
    const next = order.slice();
    next.splice(sourceIndex, 1);
    // If dropping onto top half → insert before this card; bottom half →
    // insert after. Account for the source's removal shifting indexes.
    const targetIndex = next.indexOf(panelId);
    if (targetIndex < 0) return;
    const insertAt = over === "bottom" ? targetIndex + 1 : targetIndex;
    next.splice(insertAt, 0, sourceId);
    onReorder(next);
  }

  return (
    <div
      onDragOver={draggable ? handleDragOver : undefined}
      onDragLeave={draggable ? handleDragLeave : undefined}
      onDrop={draggable ? handleDrop : undefined}
      className={
        "relative " +
        (over === "top"
          ? "before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-1 before:rounded-full before:bg-accent"
          : over === "bottom"
            ? "after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-1 after:rounded-full after:bg-accent"
            : "")
      }
    >
      <div
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        className={draggable ? "cursor-grab active:cursor-grabbing" : undefined}
        aria-label={
          draggable ? `Panel ${index + 1}, draggable to reorder` : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Slim "Add panel" hairline that shows on hover. Lives between every
 * pair of panels (and at the top of the list) so the user can insert a
 * blank without scrolling to a global button.
 */
function InsertSlot({
  label,
  onInsert,
}: {
  label: string;
  onInsert: () => void;
}) {
  return (
    <div className="group relative h-2">
      <button
        type="button"
        onClick={onInsert}
        aria-label={label}
        className="absolute inset-x-0 top-0 flex h-2 items-center justify-center text-[11px] text-ink-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
      >
        <span className="flex w-full items-center gap-2">
          <span className="h-px flex-1 bg-paper-line" />
          <span className="rounded-full border border-paper-line bg-surface px-2 py-0.5">
            + Add panel
          </span>
          <span className="h-px flex-1 bg-paper-line" />
        </span>
      </button>
    </div>
  );
}
