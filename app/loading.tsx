export default function Loading() {
  return <main className="mx-auto max-w-5xl px-6 py-12" role="status" aria-label="Loading page" aria-busy="true"><span className="sr-only">Loading your page…</span><div aria-hidden className="page-loading space-y-6"><div className="h-4 w-24 rounded bg-paper-line" /><div className="h-10 w-2/3 rounded-lg bg-paper-line" /><div className="h-4 w-1/2 rounded bg-paper-line" /><div className="grid gap-5 pt-6 sm:grid-cols-2"><div className="h-64 rounded-2xl bg-paper-soft" /><div className="h-64 rounded-2xl bg-paper-soft" /></div></div></main>;
}
