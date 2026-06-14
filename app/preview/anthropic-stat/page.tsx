import { renderAnthropicStat } from "@/lib/render/templates/anthropicStat";
import { renderFlowchart } from "@/lib/render/templates/flowchart";
import { renderStructural } from "@/lib/render/templates/structural";
import { renderTimeline } from "@/lib/render/templates/timeline";
import type { PanelPlan } from "@/lib/shared/schemas";

export const dynamic = "force-dynamic";

const statPanel = renderAnthropicStat({
  sectionId: "stat",
  heading: "Why long-form reading lost to social",
  caption:
    "Across a panel of 3,200 knowledge workers, the share who finish a single long article each week has fallen by more than half since 2018 — replaced almost entirely by skim-and-bookmark behaviour on feeds.",
  stat: {
    value: "27%",
    label: "of knowledge workers finish a long-read each week",
  },
  kicker: "The figure",
});

const flowVerticalPlan = {
  sectionId: "flow1",
  visualType: "flowchart",
  caption: "How a paper becomes a carousel.",
  nodes: [
    { id: "a", label: "Paste a link", subtitle: "URL or PDF", role: "start" },
    { id: "b", label: "Read for the core idea", subtitle: "comprehension" },
    { id: "c", label: "Design the panels", subtitle: "structure + plan" },
    { id: "d", label: "Hand back a carousel", subtitle: "ready to post", role: "end" },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "d" },
  ],
  layoutHint: "vertical",
  narrativeReason: "",
} satisfies Partial<PanelPlan> as PanelPlan;

const flowHorizontalPlan = {
  sectionId: "flow2",
  visualType: "flowchart",
  caption: "Three habits compound into a routine.",
  nodes: [
    { id: "a", label: "Read", role: "start" },
    { id: "b", label: "Capture" },
    { id: "c", label: "Share", role: "end" },
  ],
  edges: [
    { from: "a", to: "b", label: "10 min" },
    { from: "b", to: "c", label: "30 min" },
  ],
  layoutHint: "horizontal",
  narrativeReason: "",
} satisfies Partial<PanelPlan> as PanelPlan;

const timelinePlan = {
  sectionId: "tl",
  visualType: "timeline",
  caption: "The shape of the rollout.",
  timeline: [
    { when: "Week 1", what: "Pilot the workflow on internal documentation only." },
    { when: "Week 3", what: "Open it to a single customer-facing team with weekly check-ins." },
    { when: "Week 6", what: "Roll out org-wide; turn on the brand kit and named templates." },
    { when: "Week 10", what: "Measure adoption against the month-three baseline and lock in defaults." },
  ],
  narrativeReason: "",
} satisfies Partial<PanelPlan> as PanelPlan;

const structuralPlan = {
  sectionId: "struct",
  visualType: "structural",
  caption: "What sits inside a Readopp account.",
  nodes: [
    { id: "1", label: "Brand kit", subtitle: "colour + font", group: "Account" },
    { id: "2", label: "Templates", subtitle: "19 + custom", group: "Account" },
    { id: "3", label: "Carousel", subtitle: "PNG / MP4 / GIF", group: "Outputs" },
    { id: "4", label: "Caption", subtitle: "with hashtags", group: "Outputs" },
    { id: "5", label: "Source", subtitle: "URL / PDF", group: "Inputs" },
    { id: "6", label: "Audience level", group: "Inputs" },
  ],
  narrativeReason: "",
} satisfies Partial<PanelPlan> as PanelPlan;

export default function PreviewPage() {
  const flowV = renderFlowchart(flowVerticalPlan);
  const flowH = renderFlowchart(flowHorizontalPlan);
  const timeline = renderTimeline(timelinePlan);
  const structural = renderStructural(structuralPlan);

  const samples = [
    { label: "stat_callout", svg: statPanel.content },
    { label: "flowchart · vertical", svg: flowV },
    { label: "flowchart · horizontal", svg: flowH },
    { label: "timeline", svg: timeline },
    { label: "structural · 3 groups", svg: structural },
  ].filter((s): s is { label: string; svg: string } => Boolean(s.svg));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#1a1a1a",
        padding: "48px 24px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif",
        color: "#FAF9F5",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: -0.4 }}>
          Slot-fill panel templates
        </h1>
        <p style={{ marginTop: 12, color: "#A29A8E", maxWidth: 560 }}>
          Every panel below is rendered deterministically from typed plan data
          — zero model calls. stat_callout, flowchart, timeline, structural.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 40,
          alignItems: "center",
          marginTop: 40,
        }}
      >
        {samples.map((s) => (
          <div key={s.label} style={{ width: 680 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#A29A8E",
                marginBottom: 12,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                background: "#FAF9F5",
                borderRadius: 8,
                boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
                overflow: "hidden",
              }}
              dangerouslySetInnerHTML={{ __html: s.svg }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
