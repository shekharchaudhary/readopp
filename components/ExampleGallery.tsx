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

export function ExampleGallery() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/explainers", { cache: "no-store" });
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
  }, []);

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
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const isDeleting = deletingId === it.id;
          const preview = previewOf(it);
          return (
            <li
              key={it.id}
              className={
                "group relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(45,60,30,0.05),0_10px_28px_-20px_rgba(45,60,30,0.28)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(45,60,30,0.35)] " +
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
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/[0.06] to-transparent"
                  />
                </div>

                <div className="p-4 pr-10">
                  <div className="text-sm font-medium text-ink transition-colors line-clamp-2 group-hover:text-sage-deep">
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
        <div className="h-1 w-8 rounded-full bg-sage" />
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
