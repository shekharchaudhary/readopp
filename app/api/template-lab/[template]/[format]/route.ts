import { getTemplate, templateExists } from "@/lib/templates/registry";
import { EXPORT_DIMENSIONS, isExportFormat } from "@/lib/export/dimensions";
import { TemplateIdSchema, type Explainer, type RenderedPanel } from "@/lib/shared/schemas";
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
  const fixturePanel = source ? { ...panel, heading: source.heading, caption: source.caption } : panel;
  const fixtureExplainer = source ? { ...explainer, title: source.title, publishingGoal: goal || "teach", panels: [fixturePanel] } as Explainer : explainer;
  let html = await template.renderPanel({ explainer: fixtureExplainer, panel: fixturePanel, format: params.format, panelIndex: 1, totalPanels: 5, brand: null });
  const dims = EXPORT_DIMENSIONS[params.format];
  if (query.get("fit") === "1") {
    html = html.replace("</body>", `<script>function fit(){var s=innerWidth/${dims.w};document.body.style.transform='scale('+s+')';document.body.style.transformOrigin='top left'}fit();addEventListener('resize',fit)</script></body>`);
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-template-width": String(dims.w), "x-template-height": String(dims.h) } });
}
