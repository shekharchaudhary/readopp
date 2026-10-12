"use client";
import { useState } from "react";
interface Sample { styleName: string; topic: string; note: string; svg: string }
export function SampleGallery({ samples }: { samples: Sample[] }) {
  const [selected, setSelected] = useState("all");
  const visible = selected === "all" ? samples : samples.filter(sample => sample.styleName === selected);
  return <div>
    <div className="sample-filters mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter example layouts">
      {[{id:"all",label:"All examples"},...samples.map(sample=>({id:sample.styleName,label:sample.styleName}))].map(filter => <button key={filter.id} type="button" aria-pressed={selected===filter.id} onClick={()=>setSelected(filter.id)} className={"rounded-full border px-4 py-2 text-xs transition-colors " + (selected===filter.id ? "border-ink bg-ink text-paper" : "border-paper-line bg-surface text-ink-soft hover:border-ink-muted")}>{filter.label}</button>)}
    </div>
    <p className="mb-6 text-xs text-ink-muted" role="status" aria-live="polite">{visible.length} {visible.length===1 ? "example" : "examples"}</p>
    <div className="space-y-12">{visible.map(sample=><section data-motion-item key={sample.styleName} className="sample-story rounded-2xl border border-paper-line bg-surface p-5 sm:p-7"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{sample.styleName}</span><span className="rounded-full bg-paper-soft px-2.5 py-1 text-[10px] text-ink-muted">Layout example</span></div><h2 className="text-xl font-medium tracking-tight text-ink">{sample.topic}</h2><p className="mb-5 mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{sample.note}</p><div className="panel-svg-wrap force-light overflow-hidden rounded-xl border border-paper-line bg-paper p-3 sm:p-5" dangerouslySetInnerHTML={{__html:sample.svg}} /></section>)}</div>
  </div>;
}
