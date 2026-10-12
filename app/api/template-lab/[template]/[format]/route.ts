import { getTemplate, templateExists } from "@/lib/templates/registry";
import { EXPORT_DIMENSIONS, isExportFormat } from "@/lib/export/dimensions";
import { RenderedPanelSchema, TemplateIdSchema, type Explainer, type RenderedPanel } from "@/lib/shared/schemas";
import { BENCHMARK_SOURCES } from "@/lib/benchmark/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const panel: RenderedPanel = {
  sectionId: "attention-compounds",
  heading: "Attention compounds when you protect it",
  caption: "Teams that preserve uninterrupted focus make better decisions with less recovery time.",
  format: "svg",
  content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480"><rect width="680" height="480" rx="18" fill="#F7F8FA"/><path d="M86 370 C180 355 220 320 295 290 S410 235 480 170 S555 116 596 78" fill="none" stroke="#2D6CDF" stroke-width="8" stroke-linecap="round"/><path d="M86 370 H600" stroke="#D7DDE8" stroke-width="2"/><g fill="#2D6CDF"><circle cx="86" cy="370" r="9"/><circle cx="295" cy="290" r="9"/><circle cx="480" cy="170" r="9"/><circle cx="596" cy="78" r="9"/></g><g fill="#536072" font-family="system-ui" font-size="14"><text x="74" y="410">Start</text><text x="268" y="330">Protected time</text><text x="451" y="210">Better judgment</text><text x="518" y="55">Compounding insight</text></g></svg>`,
  validated: true,
  fallback: false,
  edited: false,
  plan: {
    sectionId: "attention-compounds",
    visualType: "key_findings",
    caption: "Teams that preserve uninterrupted focus make better decisions with less recovery time.",
    narrativeReason: "Controlled template quality fixture.",
    keyFindings: {
      label: "What the research shows",
      findings: [
        { title: "23 minutes", detail: "Average recovery time after an interruption" },
        { title: "40% less", detail: "Productive capacity lost to task switching" },
        { title: "90 minutes", detail: "A practical minimum for meaningful deep work" },
      ],
    },
  },
};

const explainer: Explainer = {
  id: "template-lab",
  jobId: "template-lab-job",
  url: "https://readopp.com/research/the-compounding-value-of-focus",
  title: "The Compounding Value of Focus",
  summary: "Why uninterrupted attention improves speed, judgment, and work quality over time.",
  audienceLevel: "professional",
  publishingGoal: "teach",
  voiceProfileId: "clear_expert",
  panels: [panel],
  createdAt: "2026-08-15T12:00:00.000Z",
};

function fixtureFor(mode: string | null): RenderedPanel {
  const plan = panel.plan!;
  if (mode === "stat") return {
    ...panel,
    heading: "The cost of recovering your attention",
    plan: { ...plan, visualType: "stat_callout", keyFindings: null, stat: { value: "23 min", label: "Average time to regain focus after one interruption" } },
  };
  if (mode === "quote") return {
    ...panel,
    heading: "What deep work actually requires",
    plan: { ...plan, visualType: "quote_card", keyFindings: null, quoteCard: { text: "Clarity about what matters provides clarity about what does not.", attribution: "Cal Newport", context: "Deep Work" } },
  };
  if (mode === "framework") return {
    ...panel,
    heading: "A practical rhythm for protected attention",
    plan: { ...plan, visualType: "framework", keyFindings: null, framework: { label: "The focus loop", steps: [
      { name: "Choose", description: "Name the one outcome that matters." },
      { name: "Protect", description: "Remove competing inputs." },
      { name: "Work", description: "Stay with the problem long enough." },
      { name: "Recover", description: "Pause before beginning again." },
    ] } },
  };
  if (mode === "chart") return {
    ...panel,
    heading: "More switching, less useful work",
    plan: { ...plan, visualType: "chart", keyFindings: null, chart: { kind: "bar", title: "Productive capacity", unit: "%", series: [{ name: "Capacity", points: [
      { label: "No switching", value: 100 }, { label: "Light switching", value: 82 }, { label: "Heavy switching", value: 60 },
    ] }] } },
  };
  if (mode === "diverging") return {
    ...panel,
    heading: "The capabilities moving up — and down",
    plan: { ...plan, visualType: "chart", keyFindings: null, chart: { kind: "bar", title: "Change in demand", unit: " pp", series: [{ name: "Change", points: [
      { label: "Digital literacy", value: 15 }, { label: "Problem solving", value: 9 }, { label: "Creativity", value: 6 }, { label: "Legacy tooling", value: -4 }, { label: "Manual reporting", value: -8 },
    ] }] } },
  };
  if (mode === "architecture") return {
    ...panel,
    heading: "How the publishing pipeline moves",
    plan: { ...plan, visualType: "flowchart", keyFindings: null, nodes: [
      { id: "source", label: "Source", subtitle: "PDF or workspace", group: "Input", role: "start" },
      { id: "claims", label: "Claims", subtitle: "Grounded evidence", group: "Reason", role: "normal" },
      { id: "story", label: "Story", subtitle: "Narrative sequence", group: "Reason", role: "highlight" },
      { id: "design", label: "Design", subtitle: "Adaptive layout", group: "Create", role: "normal" },
      { id: "export", label: "Export", subtitle: "LinkedIn or X", group: "Publish", role: "end" },
    ], edges: [
      { from: "source", to: "claims", label: null }, { from: "claims", to: "story", label: null }, { from: "story", to: "design", label: null }, { from: "design", to: "export", label: null },
    ] },
  };
  if (mode === "radial") return {
    ...panel,
    heading: "Five patterns around one useful idea",
    plan: { ...plan, visualType: "structural", keyFindings: null, nodes: [
      { id: "one", label: "Evidence", subtitle: "What supports it", group: null, role: "normal" },
      { id: "two", label: "Context", subtitle: "Why it matters", group: null, role: "normal" },
      { id: "three", label: "Tension", subtitle: "What changes", group: null, role: "normal" },
      { id: "four", label: "Action", subtitle: "What to do", group: null, role: "normal" },
      { id: "five", label: "Source", subtitle: "Where to continue", group: null, role: "normal" },
    ], edges: null },
  };
  if (mode === "career") return {
    ...panel,
    heading: "A career becomes clearer when the progression is visible",
    copyOverrides: undefined,
    plan: { ...plan, visualType: "career_timeline", keyFindings: null, careerTimeline: { roles: [
      { title: "Product designer", company: "Northstar", period: "2019–2021", achievements: ["Established the research practice"] },
      { title: "Design lead", company: "Orbit", period: "2021–2024", achievements: ["Scaled a cross-functional design system"] },
      { title: "Head of design", company: "Fieldwork", period: "2024–Now", achievements: ["Connected product craft to business outcomes"] },
    ] } },
  };
  if (mode === "skills") return {
    ...panel,
    heading: "The capabilities behind durable creative work",
    copyOverrides: undefined,
    plan: { ...plan, visualType: "skills_matrix", keyFindings: null, skillsMatrix: { groups: [
      { name: "Strategy", skills: [{ name: "Systems thinking", level: "expert" }, { name: "Research", level: "strong" }] },
      { name: "Craft", skills: [{ name: "Information design", level: "expert" }, { name: "Prototyping", level: "strong" }] },
      { name: "Leadership", skills: [{ name: "Facilitation", level: "strong" }, { name: "Coaching", level: "familiar" }] },
    ] } },
  };
  if (mode === "annotated") return {
    ...panel,
    heading: "One source moves through four creative decisions",
    copyOverrides: undefined,
    plan: { ...plan, visualType: "annotated_hero", keyFindings: null, annotatedHero: {
      subject: "A source-to-story publishing workflow",
      annotations: [
        { targetHint: "source", label: "Find the evidence", sub: "Keep every claim grounded" },
        { targetHint: "story", label: "Shape the argument", sub: "Give the reader a clear sequence" },
        { targetHint: "design", label: "Match the layout", sub: "Let the content choose its form" },
        { targetHint: "publish", label: "Make it yours", sub: "Edit every element before sharing" },
      ],
    } },
  };
  return panel;
}

function densityFixture(
  candidate: RenderedPanel,
  density: string | null
): RenderedPanel {
  if (density !== "sparse" && density !== "dense") return candidate;

  const sparseItems = [
    { title: "Focus", detail: "Protect one clear priority." },
  ];
  const denseItems = [
    { title: "Start with the decision", detail: "Name the decision, the responsible owner, and the evidence required before work begins." },
    { title: "Protect uninterrupted work", detail: "Reserve a visible block that cannot be consumed by routine status messages or low-value coordination." },
    { title: "Batch routine communication", detail: "Move predictable updates into shared windows so the team can respond without abandoning difficult thinking." },
    { title: "Escalate with intent", detail: "Define the narrow conditions that justify interruption, including urgency, impact, and the person who can act." },
    { title: "Review the operating rhythm", detail: "Compare outcomes every week and adjust the boundaries when evidence shows the system is too rigid or too loose." },
    { title: "Keep the source attached", detail: "Preserve the original evidence and its context so the published story remains credible after compression." },
    { title: "Make ownership visible", detail: "Show who decides, who contributes, and where unresolved questions should return for clarification." },
    { title: "Publish the useful takeaway", detail: "End with one specific action readers can understand and apply without reconstructing the entire source." },
  ];
  const items = density === "sparse" ? sparseItems : denseItems;
  const heading =
    density === "sparse"
      ? "Protect one clear priority"
      : "A durable operating rhythm keeps difficult work moving without losing evidence, ownership, or the decisions that matter";
  const caption =
    density === "sparse"
      ? "One useful idea, given enough room to breathe."
      : "A mature visual should preserve hierarchy even when the source contains several connected claims, supporting details, and a conclusion that needs room to remain credible.";
  const primary =
    density === "sparse"
      ? "Give the central idea room to lead."
      : "The strongest publishing systems do more than shorten a source. They preserve the relationship between evidence, responsibility, sequence, and action while still giving readers one unmistakable path through the page.";
  const nextPlan = candidate.plan ? { ...candidate.plan } : undefined;

  if (nextPlan?.chart) {
    nextPlan.chart = {
      ...nextPlan.chart,
      series: [
        {
          name: nextPlan.chart.series[0]?.name ?? "Evidence",
          points: items.map((item, index) => ({
            label: item.title,
            value:
              density === "sparse"
                ? 72
                : [92, 78, 64, 51, 39, -18, -32, -47][index],
          })),
        },
      ],
    };
  }
  if (nextPlan?.nodes) {
    nextPlan.nodes = items.map((item, index) => ({
      id: `density-${index + 1}`,
      label: item.title,
      subtitle: item.detail,
      group: density === "sparse" ? "Core" : `Stage ${Math.floor(index / 2) + 1}`,
      role: index === 0 ? "highlight" : "normal",
    }));
  }
  if (nextPlan?.framework) {
    nextPlan.framework = {
      ...nextPlan.framework,
      steps: items.map((item) => ({
        name: item.title,
        description: item.detail,
      })),
    };
  }

  return {
    ...candidate,
    heading,
    caption,
    copyOverrides: {
      kicker: density === "sparse" ? "One signal" : "The complete operating model",
      primary,
      items,
    },
    plan: nextPlan,
  };
}

export async function GET(request: Request, { params }: { params: { template: string; format: string } }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const id = TemplateIdSchema.safeParse(params.template);
  if (!id.success || !templateExists(id.data) || !isExportFormat(params.format)) {
    return new Response("Invalid template or format", { status: 400 });
  }
  const template = getTemplate(id.data);
  const query = new URL(request.url).searchParams;
  const source = BENCHMARK_SOURCES.find((item) => item.id === query.get("source"));
  const goal = query.get("goal");
  const modePanel = densityFixture(
    fixtureFor(query.get("mode")),
    query.get("density")
  );
  const requestedLayout = RenderedPanelSchema.shape.layoutVariant.safeParse(query.get("layout"));
  const layoutPanel = requestedLayout.success
    ? { ...modePanel, layoutVariant: requestedLayout.data }
    : modePanel;
  const fixturePanel = source ? { ...layoutPanel, heading: source.heading, caption: source.caption } : layoutPanel;
  const fixtureExplainer = source ? { ...explainer, title: source.title, publishingGoal: goal || "teach", panels: [fixturePanel] } as Explainer : explainer;
  let html = await template.renderPanel({ explainer: fixtureExplainer, panel: fixturePanel, format: params.format, panelIndex: 1, totalPanels: 5, brand: null });
  const dims = EXPORT_DIMENSIONS[params.format];
  if (query.get("fit") === "1") {
    html = html.replace("</body>", `<script>function fit(){var s=innerWidth/${dims.w};document.body.style.transform='scale('+s+')';document.body.style.transformOrigin='top left'}fit();addEventListener('resize',fit)</script></body>`);
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-template-width": String(dims.w), "x-template-height": String(dims.h) } });
}
