"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sourceLabel } from "@/lib/shared/source";

interface PanelPeek {
  sectionId: string;
  heading: string;
  content: string;
  format: "svg" | "html";
}

interface Item {
  id: string;
  title: string;
  summary: string;
  url: string;
  audienceLevel: string;
  panelCount: number;
  createdAt: string;
  panel: PanelPeek | null;
  secondPanel: PanelPeek | null;
}

/** Prefer an SVG panel for the thumbnail — HTML tables don't carry their app styles. */
function previewOf(it: Item): PanelPeek | null {
  if (it.panel?.format === "svg") return it.panel;
  if (it.secondPanel?.format === "svg") return it.secondPanel;
  return null;
}

interface Props {
  /**
   * Where to fetch the gallery items from. Defaults to /api/explainers
   * (the current user's recent). Pass /api/explainers/samples to
   * surface the curated showcase list instead.
   */
  source?: string;
  /**
   * When false, the inline ✕ delete button is hidden — used for the
   * curated samples gallery where visitors don't own the items.
   * Defaults to true.
   */
  showDelete?: boolean;
}

export function ExampleGallery({
  source = "/api/explainers",
  showDelete = true,
}: Props = {}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(source, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setItems(data.explainers || []);
      } catch {
        // ignore — gallery is decorative
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  async function handleDelete(item: Item) {
    if (deletingId) return;
    const ok = window.confirm(`Delete "${item.title}"? This can't be undone.`);
    if (!ok) return;
    setDeletingId(item.id);
    // Optimistic remove
    const prev = items;
    setItems((curr) => (curr ?? []).filter((x) => x.id !== item.id));
    try {
      const res = await fetch(`/api/explainers/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        // Revert on a real server error; 404 means it was already gone.
        setItems(prev);
        window.alert("Couldn't delete. Try again.");
      }
    } catch {
      setItems(prev);
      window.alert("Couldn't delete. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (items === null || items.length === 0) return null;

  return (
    <div aria-label="Recent explainers">
      <ul className="grid grid-cols-1 border-t border-ink sm:grid-cols-2">
        {items.map((it) => {
          const isDeleting = deletingId === it.id;
          const preview = previewOf(it);
          return (
            <li
              key={it.id}
              className={
                "group relative overflow-hidden border-b border-paper-line bg-surface sm:odd:border-r " +
                (isDeleting ? "opacity-50" : "")
              }
            >
              <Link href={`/e/${it.id}`} className="block h-full">
                {/* Real panel artwork, pinned light — it's authored on white. */}
                <div className="force-light relative h-44 overflow-hidden border-b border-black/5 bg-white">
                  {preview ? (
                    <div
                      aria-hidden
                      className="panel-svg-wrap force-light pointer-events-none absolute inset-x-0 top-0 bg-white p-4 transition-transform duration-300 group-hover:scale-[1.03]"
                      dangerouslySetInnerHTML={{ __html: preview.content }}
                    />
                  ) : (
                    <TypographicFallback title={it.title} />
                  )}
                  {/* Soft fade so the clipped panel bottom reads as a window, not a cut. */}
                </div>

                <div className="p-5 pr-10">
                  <div className="font-display text-lg font-medium leading-snug text-ink line-clamp-2">
                    {it.title}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                    <span className="min-w-0 truncate">{sourceLabel(it.url)}</span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">{it.panelCount} panels</span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">{it.audienceLevel}</span>
                  </div>
                </div>
              </Link>
              {showDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${it.title}`}
                  title="Delete"
                  disabled={isDeleting}
                  onClick={() => handleDelete(it)}
                  className="absolute bottom-3 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-ink-faint opacity-0 transition-opacity hover:border-paper-line hover:bg-paper-soft hover:text-ink-soft focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CloseGlyph />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Shown when neither stored panel is SVG (e.g. both are HTML tables). */
function TypographicFallback({ title }: { title: string }) {
  return (
    <div className="force-light flex h-full items-center bg-white px-6">
      <div>
        <div className="h-px w-8 bg-ink" />
        <div className="mt-3 font-display text-lg font-medium leading-snug text-dark line-clamp-3">
          {title}
        </div>
      </div>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="11"
      height="11"
      aria-hidden
      role="presentation"
    >
      <path
        d="M3 3 L9 9 M9 3 L3 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
