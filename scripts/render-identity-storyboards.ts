import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createEditableTemplateScene } from "../lib/editor/templateScene";
import { renderEditableSceneSvg } from "../lib/editor/renderSceneSvg";
import type { Explainer, RenderedPanel, TemplateId } from "../lib/shared/schemas";

const OUTPUT = join(process.cwd(), "tmp", "identity-storyboards");
const IDENTITIES: TemplateId[] = [
  "adaptive-editorial",
  "editorial-report",
  "modern-technical",
  "data-story",
  "bold-social",
];

mkdirSync(OUTPUT, { recursive: true });

function panel(
  sectionId: string,
  heading: string,
  caption: string,
  plan: NonNullable<RenderedPanel["plan"]>,
  copyOverrides: NonNullable<RenderedPanel["copyOverrides"]>
): RenderedPanel {
  return {
    sectionId,
    heading,
    caption,
    format: "svg",
    content: "<svg/>",
    validated: true,
    fallback: false,
    edited: false,
    layoutVariant: "auto",
    plan,
    copyOverrides,
  };
}

const panels: RenderedPanel[] = [
  panel(
    "focus-hook",
    "Constant availability is a design problem",
    "Teams lose difficult thinking when every message becomes an interruption.",
    {
      sectionId: "focus-hook",
      visualType: "insight",
      caption: "Teams lose difficult thinking when every message becomes an interruption.",
      narrativeReason: "A single counter-intuitive premise opens the story.",
    },
    {
      kicker: "The hidden cost",
      primary:
        "Teams lose difficult thinking when every message becomes an interruption.",
      items: [],
    }
  ),
  panel(
    "shared-rhythm",
    "Turn availability into a shared operating rhythm",
    "Four explicit decisions replace continuous monitoring with predictable coordination.",
    {
      sectionId: "shared-rhythm",
      visualType: "framework",
      caption:
        "Four explicit decisions replace continuous monitoring with predictable coordination.",
      narrativeReason: "A named sequence makes the operating model memorable.",
      framework: {
        label: "The collaboration loop",
        steps: [
          { name: "Choose", description: "Name the work that needs depth." },
          { name: "Protect", description: "Block the time visibly." },
          { name: "Respond", description: "Batch normal communication." },
          { name: "Review", description: "Adjust the rhythm together." },
        ],
      },
    },
    {
      kicker: "The operating model",
      primary:
        "Four explicit decisions replace continuous monitoring with predictable coordination.",
      items: [
        { title: "Choose", detail: "Name the work that needs depth." },
        { title: "Protect", detail: "Block the time visibly." },
        { title: "Respond", detail: "Batch normal communication." },
        { title: "Review", detail: "Adjust the rhythm together." },
      ],
    }
  ),
  panel(
    "system-map",
    "The system works when expectations are connected",
    "Protected work, response windows, escalation, and review reinforce one another.",
    {
      sectionId: "system-map",
      visualType: "structural",
      caption:
        "Protected work, response windows, escalation, and review reinforce one another.",
      narrativeReason: "A connected system map exposes the operating dependencies.",
      nodes: [
        { id: "focus", label: "Focus", subtitle: "Protected work" },
        { id: "windows", label: "Windows", subtitle: "Routine response" },
        { id: "escalate", label: "Escalate", subtitle: "True urgency" },
        { id: "review", label: "Review", subtitle: "Tune together" },
      ],
      edges: [
        { from: "focus", to: "windows" },
        { from: "windows", to: "escalate" },
        { from: "escalate", to: "review" },
        { from: "review", to: "focus" },
      ],
    },
    {
      kicker: "The shared system",
      primary:
        "Protected work, response windows, escalation, and review reinforce one another.",
    }
  ),
  panel(
    "evidence",
    "Frequent switching quietly erodes useful capacity",
    "The evidence shows a clear decline as context switching increases.",
    {
      sectionId: "evidence",
      visualType: "chart",
      caption: "The evidence shows a clear decline as context switching increases.",
      narrativeReason: "Comparable numbers deserve a dedicated evidence view.",
      chart: {
        kind: "bar",
        title: "Useful capacity",
        unit: "%",
        series: [
          {
            name: "Capacity",
            points: [
              { label: "Protected", value: 100 },
              { label: "Light switching", value: 82 },
              { label: "Heavy switching", value: 60 },
              { label: "Recovery cost", value: -23 },
            ],
          },
        ],
      },
    },
    {
      kicker: "The evidence",
      primary: "Every interruption creates a recovery cost the calendar cannot show.",
      items: [],
    }
  ),
];

const baseExplainer = {
  id: "identity-storyboard",
  jobId: "identity-storyboard",
  url: "fixture://identity-storyboard",
  title: "Designing calmer collaboration",
  summary: "A representative story for visual identity review.",
  audienceLevel: "professional",
  publishingGoal: "teach",
  voiceProfileId: "clear_expert",
  createdAt: new Date(0).toISOString(),
  panels,
} as Explainer;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1180, height: 1300 },
      deviceScaleFactor: 1,
    });

    for (const template of IDENTITIES) {
      const explainer = { ...baseExplainer, template };
      const scenes = panels.map((candidate, index) =>
        createEditableTemplateScene({
          explainer,
          panel: candidate,
          panelIndex: index + 1,
          totalPanels: panels.length,
          template,
        })
      );
      const layouts = scenes.map((scene) => String(scene.readoppLayout));
      const cards = scenes
        .map(
          (scene, index) => `
            <article>
              <div class="meta"><b>${String(index + 1).padStart(2, "0")}</b><span>${layouts[index]}</span></div>
              <div class="panel">${renderEditableSceneSvg(scene)}</div>
            </article>`
        )
        .join("");
      await page.setContent(`<!doctype html>
        <html><head><style>
          *{box-sizing:border-box}body{margin:0;background:#e9e6df;color:#191919;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
          main{padding:34px}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:22px}
          h1{margin:0;font-size:29px;letter-spacing:-.04em;text-transform:capitalize}header p{margin:0;color:#716e67;font-size:13px}
          section{display:grid;grid-template-columns:1fr 1fr;gap:22px}
          article{overflow:hidden;border:1px solid #cfcbc1;border-radius:18px;background:#f7f5ef;box-shadow:0 16px 38px rgba(34,31,25,.09)}
          .meta{display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #ddd8ce;color:#716e67;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.meta b{color:#191919}
          .panel{aspect-ratio:1;background:white}.panel svg{display:block;width:100%;height:100%}
        </style></head><body><main><header><div><p>READOPP IDENTITY AUDIT</p><h1>${template.replaceAll("-", " ")}</h1></div><p>${layouts.join(" → ")}</p></header><section>${cards}</section></main></body></html>`);
      await page.screenshot({
        path: join(OUTPUT, `${template}.png`),
        fullPage: true,
      });
      console.log(`${template}: ${layouts.join(" → ")}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Storyboards: ${OUTPUT}`);
}

void main();
