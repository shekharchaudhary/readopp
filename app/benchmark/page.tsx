import { notFound } from "next/navigation";
import { BenchmarkWorkspace } from "@/components/benchmark/BenchmarkWorkspace";

export default function BenchmarkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-screen bg-paper px-5 py-10 sm:px-8"><div className="mx-auto max-w-7xl"><div className="mb-10"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-sky-deep">Internal quality lab</p><h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Would you actually publish it?</h1><p className="mt-3 max-w-2xl text-ink-soft">Review five source types across five premium templates and three publishing goals. The release threshold is an 80% strict pass rate.</p></div><BenchmarkWorkspace /></div></main>;
}
