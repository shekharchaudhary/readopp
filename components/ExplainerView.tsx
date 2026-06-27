"use client";

import { useEffect, useState } from "react";
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

  /** Move a panel by one step in the given direction — keyboard parallel
   *  to the mouse drag. Reuses the reorderPanels round-trip. */
  function movePanel(sectionId: string, direction: "up" | "down") {
    const ids = explainer.panels.map((p) => p.sectionId);
    const i = ids.indexOf(sectionId);
    if (i < 0) return;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    void reorderPanels(next);
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
      {!canExport && <PermalinkVisitorBanner />}
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
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Share controls always render — viewers (not just the owner)
              are the audience for sharing. */}
          <ShareBar
            explainerId={explainer.id}
            title={explainer.title}
            copied={copied}
            onCopy={copyLink}
          />
          {/* Edit + export controls only render for the owner. canExport
              is set server-side from the ownership check in page.tsx. */}
          {canExport && (
            <>
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
            </>
          )}
        </div>
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
                onMoveUp={
                  canExport && i > 0
                    ? (id) => movePanel(id, "up")
                    : undefined
                }
                onMoveDown={
                  canExport && i < explainer.panels.length - 1
                    ? (id) => movePanel(id, "down")
                    : undefined
                }
                explainerId={canExport ? explainer.id : undefined}
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

      {!canExport && <PermalinkVisitorFooter />}

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
  draggable,
  order,
  onReorder,
}: {
  children: React.ReactNode;
  panelId: string;
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
        "group relative " +
        (over === "top"
          ? "before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-1 before:rounded-full before:bg-accent"
          : over === "bottom"
            ? "after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-1 after:rounded-full after:bg-accent"
            : "")
      }
    >
      {children}
      {/* Drag source is a small handle overlay at the top-left, NOT the
          whole card. Otherwise any mousedown inside the card — including
          dragging an element inside the inline Excalidraw editor —
          triggers the HTML5 panel-reorder drag and ghosts the whole
          card. Keyboard users have the ↑/↓ buttons in the action strip. */}
      {draggable && (
        <div
          draggable
          onDragStart={handleDragStart}
          aria-label="Drag to reorder panel"
          title="Drag to reorder"
          className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-paper-line bg-surface/90 text-ink-muted opacity-0 transition-opacity hover:text-ink active:cursor-grabbing focus-visible:opacity-100 group-hover:opacity-100 hover:opacity-100"
        >
          <span aria-hidden className="text-base leading-none">⠿</span>
        </div>
      )}
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

/**
 * Share controls: copy-link + LinkedIn + X. Always visible on the
 * permalink (even for non-owners) since the audience for sharing IS
 * the viewer, not the creator.
 *
 * Window.location is read at click-time inside each callback (not at
 * render) so the bar is safe to render during SSR.
 */
/**
 * Soft brand banner that surfaces above the explainer header when a
 * visitor (not the owner) lands on a shared permalink. Every shared
 * /e/<id> link is a free funnel entry for new users — this is the CTA
 * that pulls them in. Subtle: the explainer content has to remain the
 * star of the page; this is a kicker line + link, not a marketing wall.
 */
function PermalinkVisitorBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line bg-paper-soft px-4 py-3">
      <p className="text-sm text-ink-soft">
        <span className="inline-block h-2 w-2 -translate-y-px rounded-full bg-accent align-middle" />
        <span className="ml-2 font-medium text-ink">Made with Readopp</span>
        <span className="ml-2 text-ink-muted">
          — paste any article, get a share-ready visual carousel.
        </span>
      </p>
      <a
        href="/"
        className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-opacity hover:opacity-90"
      >
        Make your own →
      </a>
    </div>
  );
}

/**
 * Stronger CTA below the panel list — commitment is highest after the
 * visitor has scrolled all the way through. Bigger headline, full-width.
 */
function PermalinkVisitorFooter() {
  return (
    <section className="rounded-lg border border-paper-line bg-paper px-6 py-10 text-center">
      <h2 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
        Turn what you read into a post like this.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
        Readopp made this carousel from a single URL. Paste any article,
        paper, or PDF — it&rsquo;s 3 free tries, no sign-up needed.
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-md bg-sky px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_0_rgba(13,87,134,0.3)] transition-[filter,background-color] hover:brightness-110"
      >
        Try Readopp
      </a>
    </section>
  );
}

function ShareBar({
  explainerId,
  title,
  copied,
  onCopy,
}: {
  explainerId: string;
  title: string;
  copied: boolean;
  onCopy: () => void;
}) {
  // navigator.share is only set after client hydration — server render
  // would never see it, so the button's presence has to flip on via
  // useEffect to avoid a hydration mismatch warning.
  const [hasWebShare, setHasWebShare] = useState(false);
  useEffect(() => {
    setHasWebShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  function permalink(): string {
    return `${window.location.origin}/e/${explainerId}`;
  }

  function shareText(): string {
    return `${title} — a visual carousel from Readopp`;
  }

  function openShare(targetUrl: string) {
    // 600×640 popup is the conventional size for social share dialogs;
    // platforms ignore it on mobile and route to the native app instead.
    const w = 600;
    const h = 640;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      targetUrl,
      "_blank",
      `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
    );
  }

  function shareLinkedIn() {
    openShare(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(permalink())}`
    );
  }

  function shareX() {
    const url = permalink();
    openShare(
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText())}`
    );
  }

  function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator
        .share({ url: permalink(), title, text: shareText() })
        .catch(() => {
          // User cancelled — silent, same as not sharing.
        });
    }
  }

  const btn =
    "rounded-md border border-paper-line bg-surface px-3 py-2 text-sm text-ink-soft hover:border-ink-muted transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={onCopy} className={btn} title="Copy permalink">
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={shareLinkedIn}
        className={btn}
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
      >
        in
      </button>
      <button
        type="button"
        onClick={shareX}
        className={btn}
        aria-label="Share on X"
        title="Share on X"
      >
        X
      </button>
      {hasWebShare && (
        <button
          type="button"
          onClick={nativeShare}
          className={btn}
          aria-label="Share via system share sheet"
          title="Share…"
        >
          Share
        </button>
      )}
    </div>
  );
}
