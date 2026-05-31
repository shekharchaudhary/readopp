"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Item {
  id: string;
  title: string;
  summary: string;
  url: string;
  audienceLevel: string;
  panelCount: number;
  createdAt: string;
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
    <section aria-label="Recent explainers" className="space-y-3">
      <h2 className="text-sm font-medium text-ink-soft">Recent</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const isDeleting = deletingId === it.id;
          return (
            <li
              key={it.id}
              className={
                "group relative rounded-lg border border-paper-line bg-white transition-colors hover:border-ink-muted " +
                (isDeleting ? "opacity-50" : "")
              }
            >
              <Link
                href={`/e/${it.id}`}
                className="block h-full p-4 pr-10"
              >
                <div className="text-sm font-medium text-ink line-clamp-2">
                  {it.title}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-ink-muted">
                  {it.summary}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
                  <span>{sourceDomain(it.url)}</span>
                  <span aria-hidden>·</span>
                  <span>{it.panelCount} panels</span>
                  <span aria-hidden>·</span>
                  <span>{it.audienceLevel}</span>
                </div>
              </Link>
              <button
                type="button"
                aria-label={`Delete ${it.title}`}
                title="Delete"
                disabled={isDeleting}
                onClick={() => handleDelete(it)}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-ink-faint opacity-0 transition-opacity hover:border-paper-line hover:bg-paper-soft hover:text-ink-soft focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <CloseGlyph />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
