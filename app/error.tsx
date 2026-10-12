"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-20"><div className="rounded-2xl border border-paper-line bg-surface p-7"><p className="text-xs text-ink-muted">Something interrupted this page</p><h1 className="mt-3 text-2xl font-medium tracking-tight text-ink">Let’s try that again.</h1><p className="mt-3 text-sm leading-6 text-ink-soft">The page couldn’t load. Try again, or return home to start a new story.</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={reset} className="site-action rounded-lg bg-ink px-4 py-2.5 text-sm text-paper">Try again</button><Link href="/" className="site-action rounded-lg border border-paper-line px-4 py-2.5 text-sm text-ink-soft">Back home</Link></div></div></main>;
}
