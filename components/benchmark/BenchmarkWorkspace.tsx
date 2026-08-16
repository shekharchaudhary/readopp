"use client";

import { useEffect, useMemo, useState } from "react";
import { BENCHMARK_CASES, REVIEW_CRITERIA } from "@/lib/benchmark/cases";

type Scores = Record<string, Record<string, boolean>>;

export function BenchmarkWorkspace() {
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<Scores>({});
  useEffect(() => { try { setScores(JSON.parse(localStorage.getItem("readopp-benchmark") || "{}")); } catch {} }, []);
  const current = BENCHMARK_CASES[index];
  const caseScores = scores[current.id] || {};
  const reviewed = useMemo(() => Object.values(scores).filter((s) => REVIEW_CRITERIA.every(([id]) => id in s)).length, [scores]);
  const passed = useMemo(() => Object.values(scores).filter((s) => REVIEW_CRITERIA.every(([id]) => s[id] === true)).length, [scores]);
  function setCriterion(id: string, value: boolean) {
    const next = { ...scores, [current.id]: { ...caseScores, [id]: value } };
    setScores(next); localStorage.setItem("readopp-benchmark", JSON.stringify(next));
  }
  function download() {
    const blob = new Blob([JSON.stringify({ reviewed, passed, passRate: reviewed ? passed / reviewed : 0, scores }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "readopp-publishability-review.json"; a.click(); URL.revokeObjectURL(a.href);
  }
  const preview = `/api/template-lab/${current.template}/square?source=${current.source.id}&goal=${current.goal}&fit=1`;
  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
    <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-sky-deep">Case {index + 1} / {BENCHMARK_CASES.length}</p><h2 className="mt-1 font-display text-2xl text-ink">{current.source.label} · {current.template}</h2><p className="mt-1 text-sm text-ink-muted">Goal: {current.goal.replaceAll("_", " ")}</p></div><div className="flex gap-2"><button onClick={() => setIndex(Math.max(0,index-1))} className="btn-ghost">←</button><button onClick={() => setIndex(Math.min(BENCHMARK_CASES.length-1,index+1))} className="btn-primary">Next →</button></div></div><iframe key={preview} title="Template benchmark output" src={preview} className="aspect-square w-full rounded-2xl border border-paper-line bg-white shadow-xl" /></section>
    <aside className="rounded-2xl border border-paper-line bg-surface p-5 lg:sticky lg:top-24 lg:self-start"><div className="flex justify-between border-b border-paper-line pb-4"><div><p className="text-sm font-semibold text-ink">Publishability scorecard</p><p className="mt-1 text-xs text-ink-muted">Pass only when every answer is yes.</p></div><span className="font-mono text-xs text-sky-deep">{reviewed}/75</span></div><div className="divide-y divide-paper-line">{REVIEW_CRITERIA.map(([id,label]) => <div key={id} className="py-4"><p className="text-sm leading-5 text-ink-soft">{label}</p><div className="mt-2 flex gap-2"><button onClick={() => setCriterion(id,true)} className={"flex-1 rounded-lg border py-2 text-xs font-medium " + (caseScores[id] === true ? "border-sky bg-sky text-white" : "border-paper-line")}>Yes</button><button onClick={() => setCriterion(id,false)} className={"flex-1 rounded-lg border py-2 text-xs font-medium " + (caseScores[id] === false ? "border-coral bg-coral text-white" : "border-paper-line")}>No</button></div></div>)}</div><div className="mt-5 rounded-xl bg-paper-soft p-4 text-sm"><div className="flex justify-between"><span>Strict passes</span><b>{passed}</b></div><div className="mt-2 flex justify-between"><span>Pass rate</span><b>{reviewed ? Math.round(passed/reviewed*100) : 0}%</b></div></div><button onClick={download} className="mt-4 w-full rounded-xl border border-paper-line py-2.5 text-xs font-semibold text-ink-soft">Export review JSON</button></aside>
  </div>;
}
