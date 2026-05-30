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

  if (items === null || items.length === 0) return null;

  return (
    <section aria-label="Recent explainers" className="space-y-3">
      <h2 className="text-sm font-medium text-ink-soft">Recent</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={`/e/${it.id}`}
              className="block h-full rounded-lg border border-paper-line bg-white p-4 transition-colors hover:border-ink-muted"
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
          </li>
        ))}
      </ul>
    </section>
  );
}
