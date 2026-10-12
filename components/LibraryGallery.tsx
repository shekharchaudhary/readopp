"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sourceLabel } from "@/lib/shared/source";

export interface LibraryItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  panelCount: number;
  createdLabel: string;
  preview: {
    heading: string;
    content: string;
  } | null;
}

export function LibraryGallery({ initialItems }: { initialItems: LibraryItem[] }) {
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = initialItems.filter((item) =>
      `${item.title} ${item.summary} ${sourceLabel(item.url)}`
        .toLocaleLowerCase()
        .includes(needle),
    );
    return sort === "title" ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : sort === "oldest" ? [...filtered].reverse() : filtered;
  }, [initialItems, query, sort]);

  if (initialItems.length === 0) return <EmptyLibrary />;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-[#d8d4ca] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#8b877f]">
            Saved stories
          </p>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-[#77736c]">
            {visibleItems.length} {visibleItems.length === 1 ? "story" : "stories"}{query ? ` matching “${query}”` : " in your library"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <label className="sr-only" htmlFor="library-sort">Sort stories</label>
        <select id="library-sort" value={sort} onChange={event => setSort(event.target.value)} className="rounded-xl border border-paper-line bg-surface px-3 py-2.5 text-xs text-ink-soft"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search your library</span>
          <svg aria-hidden viewBox="0 0 20 20" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8881]">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m12.5 12.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your stories"
            className="w-full rounded-xl border border-[#d8d4ca] bg-white py-2.5 pl-10 pr-4 text-sm text-[#484848] outline-none transition placeholder:text-[#a19d95] focus:border-[#94b85f] focus:ring-2 focus:ring-[#cce68a]/40"
          />
        </label>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, index) => (
            <LibraryCard key={item.id} item={item} index={index} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#cec9bf] px-6 py-16 text-center">
          <h2 className="text-xl font-bold tracking-[-.03em] text-[#484848]">No matching stories</h2>
          <p className="mt-2 text-sm text-[#77736c]">Try another title, topic, or source.</p>
          <button type="button" onClick={() => setQuery("")} className="mt-4 rounded-lg border border-paper-line px-4 py-2 text-xs text-ink-soft">Clear search</button>
        </div>
      )}
    </div>
  );
}

function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  return (
    <li data-motion-item className="library-card group overflow-hidden rounded-[22px] border border-[#dedbd3] bg-white" style={{ "--library-index": index } as React.CSSProperties}>
      <Link href={`/e/${item.id}`} className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7eae3f]">
        <div className="force-light relative aspect-[4/3] overflow-hidden border-b border-[#ebe8e1] bg-[#f5f1e9]">
          {item.preview ? (
            <div
              aria-hidden
              className="panel-svg-wrap pointer-events-none absolute inset-x-0 top-0 bg-white p-4 transition-transform duration-500 group-hover:scale-[1.035]"
              dangerouslySetInnerHTML={{ __html: item.preview.content }}
            />
          ) : (
            <TypographicPreview title={item.title} />
          )}
          <span className="absolute left-4 top-4 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#6f6b64] shadow-sm backdrop-blur">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[.1em] text-[#8b877f]">
            <span>{item.createdLabel}</span>
            <span>{item.panelCount} panels</span>
          </div>
          <h2 className="mt-4 line-clamp-2 text-xl font-bold leading-[1.12] tracking-[-.035em] text-[#484848]">
            {item.title}
          </h2>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#77736c]">{item.summary}</p>
          <div className="mt-5 flex items-center justify-between border-t border-[#ebe8e1] pt-4 text-xs">
            <span className="min-w-0 truncate pr-3 text-[#8b877f]">{sourceLabel(item.url)}</span>
            <span className="shrink-0 font-bold text-[#648e2e] transition-transform group-hover:translate-x-1">Open story →</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function TypographicPreview({ title }: { title: string }) {
  return (
    <div className="flex h-full items-end bg-[#f5f1e9] p-7">
      <div>
        <span className="block h-1 w-9 rounded-full bg-[#7eae3f]" />
        <p className="mt-4 line-clamp-3 max-w-xs text-2xl font-bold leading-[1.02] tracking-[-.045em] text-[#484848]">
          {title}
        </p>
      </div>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[#dedbd3] bg-white px-6 py-16 text-center sm:px-10 sm:py-24">
      <div aria-hidden className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-[#cce68a]/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-[#eadff0]/50 blur-3xl" />
      <span className="relative mx-auto grid h-12 w-12 rotate-[-5deg] place-items-center rounded-2xl bg-[#cce68a] text-lg font-bold text-[#484848]">R</span>
      <h2 className="relative mt-6 text-3xl font-bold tracking-[-.045em] text-[#484848]">Your library is ready.</h2>
      <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-[#77736c]">
        Create your first visual story and it will appear here automatically, ready to edit or publish again.
      </p>
      <Link href="/#try" className="relative mt-7 inline-flex rounded-xl bg-[#484848] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#333]">
        Create your first story →
      </Link>
    </div>
  );
}
