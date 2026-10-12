import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-20"><div className="rounded-2xl border border-paper-line bg-surface p-7"><p className="text-xs text-ink-muted">Page not found</p><h1 className="mt-3 text-2xl font-medium tracking-tight text-ink">This story isn’t here.</h1><p className="mt-3 text-sm leading-6 text-ink-soft">Check the link or return home to create something new.</p><Link href="/" className="site-action mt-6 inline-flex rounded-lg bg-ink px-4 py-2.5 text-sm text-paper">Back to Readopp →</Link></div></main>;
}
