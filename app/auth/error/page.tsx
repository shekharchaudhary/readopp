import Link from "next/link";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
export const dynamic = "force-dynamic";
export default function AuthErrorPage({ searchParams }: { searchParams: { reason?: string } }) {
  return <><Nav /><main className="mx-auto max-w-xl px-6 py-16 sm:py-24"><section className="rounded-2xl border border-paper-line bg-surface p-6 sm:p-8"><span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-paper-soft text-lg text-ink-muted">↻</span><h1 className="mt-5 text-2xl font-medium tracking-tight text-ink">Sign-in didn’t complete.</h1><p className="mt-3 text-sm leading-6 text-ink-soft">We couldn’t finish connecting your account. Return home and try signing in again.</p><Link href="/" className="site-action mt-6 inline-flex rounded-xl bg-ink px-4 py-3 text-sm text-paper">Back home to retry →</Link><details className="mt-6 border-t border-paper-line pt-4"><summary className="cursor-pointer text-xs text-ink-muted">Error details</summary><pre className="mt-3 overflow-x-auto rounded-lg bg-paper-soft p-3 text-xs text-ink-soft">{searchParams.reason ?? "unknown_error"}</pre></details></section></main><Footer /></>;
}
