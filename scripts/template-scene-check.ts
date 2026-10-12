import { createHash } from "node:crypto";
import {
  PANEL_LAYOUT_IDS,
  chooseAdaptivePanelLayout,
  chooseCarouselPanelLayout,
  chooseCarouselPanelLayouts,
  chooseTemplatePanelLayout,
  panelLayoutCompatibility,
  suggestedTemplatePanelLayouts,
  suggestedPanelLayouts,
} from "../lib/templates/panelLayouts";
import { createEditableTemplateScene } from "../lib/editor/templateScene";
import { renderEditableSceneSvg } from "../lib/editor/renderSceneSvg";
import {
  clearCanvasOverride,
  isCanvasOverride,
  markCanvasOverride,
} from "../lib/templates/canvasOverride";
import {
  canvasSeedVersion,
  usesRenderedTemplateSeed,
} from "../lib/editor/canvasSeed";
import { recommendTemplates } from "../lib/templates/recommend";
import type { Explainer, RenderedPanel } from "../lib/shared/schemas";

const panel = {
  sectionId: "scene-check",
  heading: "A mature visual system should fit the story",
  caption: "A single source can become a focused, editable visual without losing its evidence.",
  format: "svg",
  content: "<svg/>",
  validated: true,
  fallback: false,
  edited: false,
  copyOverrides: {
    kicker: "The evidence",
    primary: "The strongest layout is selected from the structure of the source, then remains fully editable.",
    items: [
      { title: "Signal", detail: "+18% clarity after reducing competing elements" },
      { title: "Structure", detail: "Five ideas arranged in a deliberate reading order" },
      { title: "Evidence", detail: "Three sourced facts remain attached to the argument" },
      { title: "Action", detail: "Readers can understand the next step in seconds" },
      { title: "Context", detail: "The visual keeps enough nuance to remain credible" },
    ],
  },
  plan: {
    visualType: "structural",
    narrativeReason: "Fixture exercises every mature native layout.",
    nodes: [
      { id: "source", label: "Source", detail: "Document" },
      { id: "argument", label: "Argument", detail: "Central claim" },
      { id: "evidence", label: "Evidence", detail: "Supporting facts" },
      { id: "story", label: "Story", detail: "Clear sequence" },
      { id: "publish", label: "Publish", detail: "LinkedIn or X" },
    ],
    edges: [
      { from: "source", to: "argument" },
      { from: "argument", to: "evidence" },
      { from: "evidence", to: "story" },
      { from: "story", to: "publish" },
    ],
    framework: {
      title: "Publishing system",
      steps: [
        { label: "Read", description: "Bring the source" },
        { label: "Find", description: "Identify the argument" },
        { label: "Shape", description: "Match the layout" },
        { label: "Edit", description: "Make it yours" },
      ],
    },
    keyFindings: {
      title: "What matters",
      findings: ["Clear hierarchy", "Sourced evidence", "Editable output"],
    },
    definitionCard: { term: "READOPP", definition: "Source to visual story" },
    chart: {
      title: "Change in reader response",
      unit: "%",
      series: [
        {
          name: "Impact",
          points: [
            { label: "Clarity", value: 18 },
            { label: "Recall", value: 12 },
            { label: "Noise", value: -9 },
            { label: "Effort", value: -6 },
          ],
        },
      ],
    },
  },
} as unknown as RenderedPanel;

const explainer = {
  id: "template-scene-check",
  jobId: "template-scene-check",
  url: "fixture.pdf",
  title: "Template scene check",
  summary: "A rich fixture for every mature layout.",
  audienceLevel: "general",
  publishingGoal: "teach",
  voiceProfileId: "clear_expert",
  createdAt: new Date(0).toISOString(),
  panels: [panel],
  template: "adaptive-editorial",
} as unknown as Explainer;

type SceneRecord = Record<string, unknown>;

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textBounds(element: SceneRecord) {
  const x = numberValue(element.x);
  const y = numberValue(element.y);
  const width = numberValue(element.width);
  const height = numberValue(element.height);
  return { x, y, width, height, right: x + width, bottom: y + height };
}

function assertVisibleTextGeometry(layout: string, scene: Record<string, unknown>) {
  const elements = Array.isArray(scene.elements)
    ? (scene.elements as SceneRecord[])
    : [];
  for (const element of elements.filter((candidate) => candidate.type === "text")) {
    const bounds = textBounds(element);
    const label = String(element.originalText ?? element.text ?? "text").slice(0, 44);
    if (
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.width < 1 ||
      bounds.height < 1 ||
      bounds.right > 1080 ||
      bounds.bottom > 1080
    ) {
      throw new Error(
        `${layout}: text escaped the editable canvas (${label}) at ${JSON.stringify(bounds)}`
      );
    }
  }
}

function findTextElement(scene: Record<string, unknown>, originalText: string) {
  const elements = Array.isArray(scene.elements)
    ? (scene.elements as SceneRecord[])
    : [];
  return elements.find(
    (element) => element.type === "text" && element.originalText === originalText
  );
}

function countTextElements(scene: Record<string, unknown>, originalText: string) {
  const elements = Array.isArray(scene.elements)
    ? (scene.elements as SceneRecord[])
    : [];
  return elements.filter(
    (element) => element.type === "text" && element.originalText === originalText
  ).length;
}

function assertDoesNotOverlap(
  label: string,
  first: SceneRecord | undefined,
  second: SceneRecord | undefined
) {
  if (!first || !second) throw new Error(`${label}: expected editable text elements were missing`);
  const a = textBounds(first);
  const b = textBounds(second);
  const overlaps =
    a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
  if (overlaps) {
    throw new Error(`${label}: editable text boxes overlap (${JSON.stringify(a)} / ${JSON.stringify(b)})`);
  }
}

const fingerprints = new Set<string>();
for (const layout of PANEL_LAYOUT_IDS) {
  const candidate = { ...panel, layoutVariant: layout } as RenderedPanel;
  const scene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [candidate] },
    panel: candidate,
    panelIndex: 1,
    totalPanels: 1,
    template: "adaptive-editorial",
  });
  const svg = renderEditableSceneSvg(scene);
  if (!svg.includes('viewBox="0 0 1080 1080"')) throw new Error(`${layout}: invalid viewport`);
  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  assertVisibleTextGeometry(layout, scene);
  if (!elements.some((element) => element && typeof element === "object" && "originalText" in element && element.originalText === candidate.heading)) {
    throw new Error(`${layout}: heading missing`);
  }
  if (/<script|on\w+=/i.test(svg)) throw new Error(`${layout}: unsafe markup`);
  const fingerprint = createHash("sha256").update(svg).digest("hex");
  if (fingerprints.has(fingerprint)) throw new Error(`${layout}: duplicate scene`);
  fingerprints.add(fingerprint);
  const elementCount = elements.length;
  if (elementCount < 8) throw new Error(`${layout}: scene is too shallow`);
  console.log(`${layout.padEnd(12)} ${String(elementCount).padStart(2)} editable elements ${fingerprint.slice(0, 8)}`);
}

console.log(`Verified ${fingerprints.size} distinct, safe, native editable layouts.`);

const itemlessEssayCopy =
  "A focused argument can carry enough context to remain credible while the visual still keeps generous spacing and one unmistakable reading path.";
const itemlessEssayPanel = {
  ...panel,
  sectionId: "itemless-essay",
  heading: "One clear thesis is stronger than repeated filler",
  caption: itemlessEssayCopy,
  layoutVariant: "essay" as const,
  copyOverrides: {
    kicker: "The argument",
    primary: itemlessEssayCopy,
    items: [],
  },
  plan: {
    ...panel.plan!,
    visualType: "insight" as const,
    insight: { text: itemlessEssayCopy },
  },
} as RenderedPanel;
const itemlessEssayScene = createEditableTemplateScene({
  explainer: { ...explainer, panels: [itemlessEssayPanel] },
  panel: itemlessEssayPanel,
  panelIndex: 1,
  totalPanels: 1,
  template: "editorial-report",
});
if (countTextElements(itemlessEssayScene, itemlessEssayPanel.heading) !== 1) {
  throw new Error("itemless essay repeated its heading");
}
if (countTextElements(itemlessEssayScene, itemlessEssayCopy) !== 1) {
  throw new Error("itemless essay repeated its primary insight");
}
assertVisibleTextGeometry("itemless essay", itemlessEssayScene);
console.log("Verified itemless editorial essays render one clear, editable thesis without duplicated copy.");

for (const layoutVariant of ["architecture", "diverging"] as const) {
  const editorialFigurePanel = {
    ...panel,
    sectionId: `editorial-${layoutVariant}`,
    layoutVariant,
  } as RenderedPanel;
  const editorialFigureScene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [editorialFigurePanel] },
    panel: editorialFigurePanel,
    panelIndex: 1,
    totalPanels: 1,
    template: "editorial-report",
  });
  const figureLabel =
    layoutVariant === "architecture"
      ? "FIGURE · RELATIONSHIP MAP"
      : "FIGURE · EVIDENCE DISTRIBUTION";
  if (!findTextElement(editorialFigureScene, figureLabel)) {
    throw new Error(`editorial ${layoutVariant} lost its publication figure treatment`);
  }
  if (!findTextElement(editorialFigureScene, `Figure. ${panel.caption}`)) {
    throw new Error(`editorial ${layoutVariant} lost its editable figure caption`);
  }
  assertVisibleTextGeometry(`editorial ${layoutVariant}`, editorialFigureScene);
}
console.log("Verified editorial diagrams and charts retain a distinct, editable publication figure treatment.");

const itemlessReportPanel = {
  ...itemlessEssayPanel,
  sectionId: "itemless-report",
  layoutVariant: "report" as const,
} as RenderedPanel;
const itemlessReportScene = createEditableTemplateScene({
  explainer: { ...explainer, panels: [itemlessReportPanel] },
  panel: itemlessReportPanel,
  panelIndex: 1,
  totalPanels: 1,
  template: "modern-technical",
});
if (countTextElements(itemlessReportScene, itemlessReportPanel.heading) !== 1) {
  throw new Error("itemless report repeated its heading");
}
if (countTextElements(itemlessReportScene, itemlessEssayCopy) !== 1) {
  throw new Error("itemless report repeated its primary insight");
}
if (findTextElement(itemlessReportScene, "IDEA")) {
  throw new Error("itemless report invented a generic diagram node");
}
const itemlessReportElements = Array.isArray(itemlessReportScene.elements)
  ? (itemlessReportScene.elements as SceneRecord[])
  : [];
const itemlessReportCopy = findTextElement(
  itemlessReportScene,
  itemlessEssayCopy
);
const itemlessReportFrame = itemlessReportElements.find(
  (element) =>
    element.type === "rectangle" &&
    numberValue(element.x) === 175 &&
    numberValue(element.y) === 405 &&
    numberValue(element.width) === 730 &&
    numberValue(element.height) === 330
);
if (
  !itemlessReportCopy ||
  !itemlessReportFrame ||
  textBounds(itemlessReportCopy).bottom >
    numberValue(itemlessReportFrame.y) +
      numberValue(itemlessReportFrame.height) -
      40
) {
  throw new Error("itemless report thesis lost its intentional card spacing");
}
assertVisibleTextGeometry("itemless report", itemlessReportScene);
console.log("Verified itemless reports keep one focused thesis inside a deliberately spaced card.");

const greenDivergingPanel = {
  ...panel,
  sectionId: "green-diverging",
  layoutVariant: "diverging" as const,
  themeColor: "#258A55",
} as RenderedPanel;
const greenDivergingScene = createEditableTemplateScene({
  explainer: { ...explainer, panels: [greenDivergingPanel] },
  panel: greenDivergingPanel,
  panelIndex: 1,
  totalPanels: 1,
  template: "data-story",
});
const divergingBarColors = new Set(
  (Array.isArray(greenDivergingScene.elements)
    ? (greenDivergingScene.elements as SceneRecord[])
    : []
  )
    .filter(
      (element) =>
        element.type === "rectangle" &&
        numberValue(element.height) === 34
    )
    .map((element) => String(element.backgroundColor))
);
if (divergingBarColors.size < 2) {
  throw new Error("green data identity collapsed positive and negative bars into one color");
}
console.log("Verified diverging evidence keeps positive and negative values visually distinct.");

const stressItems = [
  {
    title: "Protect uninterrupted focus before opening communication windows",
    detail: "Batch messages into two or three deliberate periods so the working day keeps enough depth for difficult decisions.",
  },
  {
    title: "Make response expectations explicit across every collaborating team",
    detail: "A visible service level removes the pressure to monitor every channel continuously while preserving trust and momentum.",
  },
  {
    title: "Separate truly urgent work from activity that merely feels immediate",
    detail: "Use a narrow escalation path for incidents; everything else can wait for the next scheduled communication window.",
  },
  {
    title: "Measure whether the new rhythm improves both output and coordination",
    detail: "Track completed deep-work blocks alongside delayed decisions so the system optimizes the whole team rather than one person.",
  },
  {
    title: "Adjust the cadence without abandoning the principle behind the change",
    detail: "Teams can move the windows as their work changes while retaining protected time, clear expectations, and a reliable escalation path.",
  },
];
const stressPanel = {
  ...panel,
  sectionId: "stress-copy",
  heading: "A deliberately detailed framework should stay readable, editable, and visually composed in every suggested layout",
  caption:
    "Long source material should produce a mature visual hierarchy without hidden copy, clipped text, or accidental collisions.",
  copyOverrides: {
    kicker: "A practical operating system",
    primary:
      "Communication improves when availability is designed as a shared system instead of treated as a constant personal obligation.",
    items: stressItems,
  },
} as unknown as RenderedPanel;

for (const layout of PANEL_LAYOUT_IDS) {
  const candidate = { ...stressPanel, layoutVariant: layout } as RenderedPanel;
  const scene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [candidate] },
    panel: candidate,
    panelIndex: 1,
    totalPanels: 1,
    template: "adaptive-editorial",
  });
  assertVisibleTextGeometry(`${layout} stress`, scene);
  const heading = findTextElement(scene, candidate.heading);
  if (!heading || !String(heading.text ?? "").includes("\n")) {
    throw new Error(`${layout}: stress heading did not preserve wrapped editable copy`);
  }
  if (layout === "priorities") {
    for (const item of stressItems) {
      assertDoesNotOverlap(
        `priorities row ${item.title}`,
        findTextElement(scene, item.title),
        findTextElement(scene, item.detail)
      );
    }
  }
  if (layout === "architecture") {
    for (const item of stressItems) {
      assertDoesNotOverlap(
        `architecture node ${item.title}`,
        findTextElement(scene, item.title),
        findTextElement(scene, item.detail)
      );
    }
  }
  if (layout === "radial" || layout === "hierarchy") {
    for (const item of stressItems.slice(0, 4)) {
      assertDoesNotOverlap(
        `${layout} heading and ${item.title}`,
        heading,
        findTextElement(scene, item.title)
      );
    }
  }
}
console.log("Verified long structured copy remains visible and collision-free across every editable layout.");

const streamedSecondPanel = {
  ...stressPanel,
  sectionId: "streamed-second-panel",
  layoutVariant: "auto" as const,
} as RenderedPanel;
const sparseStreamLayout = chooseCarouselPanelLayout(
  [streamedSecondPanel],
  2,
  streamedSecondPanel
);
if (sparseStreamLayout !== chooseAdaptivePanelLayout(streamedSecondPanel, 2)) {
  throw new Error(
    `sparse streaming slot resolved ${sparseStreamLayout} instead of its content-aware fallback`
  );
}
console.log("Verified out-of-order streaming panels resolve safely before earlier slots arrive.");

const matureIdentities = [
  "adaptive-editorial",
  "editorial-report",
  "modern-technical",
  "data-story",
  "bold-social",
] as const;
const identityFingerprints = new Set<string>();
const automaticIdentityLayouts = new Set<string>();
const flexibleIdentityPanel = {
  ...panel,
  sectionId: "identity-flexible-insight",
  layoutVariant: "auto" as const,
  copyOverrides: {
    kicker: "The premise",
    primary:
      "A flexible editorial insight can change composition without changing its meaning.",
    items: [],
  },
  plan: {
    sectionId: "identity-flexible-insight",
    visualType: "insight" as const,
    caption:
      "A flexible editorial insight can change composition without changing its meaning.",
    narrativeReason:
      "This fixture checks identity-led composition without a required semantic diagram.",
    insight: {
      text: "A flexible editorial insight can change composition without changing its meaning.",
    },
  },
} as unknown as RenderedPanel;
for (const template of matureIdentities) {
  const candidate = { ...panel, layoutVariant: "cover" as const } as RenderedPanel;
  const scene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [candidate], template },
    panel: candidate,
    panelIndex: 1,
    totalPanels: 1,
    template,
  });
  const svg = renderEditableSceneSvg(scene);
  const fingerprint = createHash("sha256").update(svg).digest("hex");
  if (identityFingerprints.has(fingerprint)) {
    throw new Error(`${template}: identity is not visually distinct`);
  }
  identityFingerprints.add(fingerprint);
  const elements = Array.isArray(scene.elements) ? scene.elements : [];
  if (elements.length < 14) throw new Error(`${template}: identity lacks editable structure`);
  if (template === "data-story") {
    const records = elements as SceneRecord[];
    const analyticalHeader = records.find(
      (element) =>
        element.type === "rectangle" &&
        element.backgroundColor === "#10261A" &&
        numberValue(element.x) === 48 &&
        numberValue(element.y) === 48
    );
    const lightHeading = records.find(
      (element) =>
        element.type === "text" &&
        element.originalText === candidate.heading &&
        element.strokeColor === "#F2F6F2"
    );
    if (!analyticalHeader || !lightHeading) {
      throw new Error("data-story lost its chart-first analytical header system");
    }
  }
  console.log(`${template.padEnd(19)} ${String(elements.length).padStart(2)} identity elements ${fingerprint.slice(0, 8)}`);

  const automaticCandidate = flexibleIdentityPanel;
  const automaticScene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [automaticCandidate], template },
    panel: automaticCandidate,
    panelIndex: 1,
    totalPanels: 1,
    template,
  });
  const expectedAutomaticLayout = chooseTemplatePanelLayout(
    [automaticCandidate],
    1,
    automaticCandidate,
    template
  );
  if (automaticScene.readoppLayout !== expectedAutomaticLayout) {
    throw new Error(
      `${template}: renderer and picker resolved different automatic layouts`
    );
  }
  const identitySuggestions = suggestedTemplatePanelLayouts(
    automaticCandidate,
    1,
    template,
    [automaticCandidate]
  );
  if (identitySuggestions[0]?.id !== expectedAutomaticLayout) {
    throw new Error(
      `${template}: suggestion ranking did not lead with rendered automatic layout`
    );
  }
  if (
    identitySuggestions
      .slice(0, 3)
      .some((choice) => !panelLayoutCompatibility(automaticCandidate, choice.id).compatible)
  ) {
    throw new Error(`${template}: identity-aware primary suggestions included an incompatible layout`);
  }
  automaticIdentityLayouts.add(String(automaticScene.readoppLayout));

  const denseCandidate = {
    ...stressPanel,
    layoutVariant: "auto" as const,
  } as RenderedPanel;
  const denseScene = createEditableTemplateScene({
    explainer: { ...explainer, panels: [denseCandidate], template },
    panel: denseCandidate,
    panelIndex: 1,
    totalPanels: 1,
    template,
  });
  assertVisibleTextGeometry(`${template} dense automatic`, denseScene);
  const denseHeading = findTextElement(denseScene, denseCandidate.heading);
  if (!denseHeading || !String(denseHeading.text ?? "").includes("\n")) {
    throw new Error(`${template}: dense automatic heading did not wrap as editable text`);
  }
}
console.log(`Verified ${identityFingerprints.size} distinct mature visual identities.`);
if (automaticIdentityLayouts.size < 3) {
  throw new Error(
    `automatic identities collapsed into ${automaticIdentityLayouts.size} composition families`
  );
}
console.log(
  `Verified ${automaticIdentityLayouts.size} distinct automatic composition families for flexible editorial content.`
);
console.log("Verified dense structured copy stays visible and editable in every mature identity.");

const longHeading =
  "A deliberately long source heading should remain completely editable without escaping the visible social panel";
const longHeadingPanel = {
  ...panel,
  sectionId: "long-heading",
  heading: longHeading,
  layoutVariant: "cover" as const,
} as RenderedPanel;
const longHeadingScene = createEditableTemplateScene({
  explainer: { ...explainer, panels: [longHeadingPanel] },
  panel: longHeadingPanel,
  panelIndex: 1,
  totalPanels: 1,
  template: "adaptive-editorial",
});
const headingElement = (longHeadingScene.elements as Array<Record<string, unknown>>).find(
  (element) => element.originalText === longHeading
);
if (
  !headingElement ||
  typeof headingElement.text !== "string" ||
  !headingElement.text.includes("\n") ||
  Number(headingElement.height) <= Number(headingElement.fontSize)
) {
  throw new Error("long heading did not receive editable wrapped geometry");
}
console.log("Verified variable-length headings wrap into accurate editable geometry.");

const flexiblePlan = {
  ...panel.plan,
  visualType: "insight" as const,
  nodes: [],
  edges: [],
  framework: undefined,
  keyFindings: undefined,
  chart: undefined,
};
const genreAwareCases = [
  {
    name: "career timeline",
    expected: "priorities",
    panel: {
      ...panel,
      sectionId: "genre-career",
      copyOverrides: undefined,
      plan: {
        ...flexiblePlan,
        visualType: "career_timeline" as const,
        careerTimeline: {
          roles: [
            { title: "Engineer", company: "Northstar", period: "2020–2023", achievements: ["Built the platform"] },
            { title: "Lead", company: "Orbit", period: "2023–Now", achievements: ["Grew the team"] },
          ],
        },
      },
    } as RenderedPanel,
  },
  {
    name: "skills matrix",
    expected: "hierarchy",
    panel: {
      ...panel,
      sectionId: "genre-skills",
      copyOverrides: undefined,
      plan: {
        ...flexiblePlan,
        visualType: "skills_matrix" as const,
        skillsMatrix: {
          groups: [
            { name: "Strategy", skills: [{ name: "Systems thinking", level: "expert" as const }] },
            { name: "Craft", skills: [{ name: "Information design", level: "strong" as const }] },
          ],
        },
      },
    } as RenderedPanel,
  },
  {
    name: "annotated subject",
    expected: "radial",
    panel: {
      ...panel,
      sectionId: "genre-annotated",
      copyOverrides: undefined,
      plan: {
        ...flexiblePlan,
        visualType: "annotated_hero" as const,
        annotatedHero: {
          subject: "A publishing workflow",
          annotations: [
            { targetHint: "source", label: "Source", sub: "Bring the evidence" },
            { targetHint: "story", label: "Story", sub: "Find the argument" },
            { targetHint: "post", label: "Publish", sub: "Share the result" },
          ],
        },
      },
    } as RenderedPanel,
  },
  {
    name: "hero statistic",
    expected: "cover",
    panel: {
      ...panel,
      sectionId: "genre-stat",
      copyOverrides: undefined,
      plan: {
        ...flexiblePlan,
        visualType: "stat_callout" as const,
        stat: { value: "41%", label: "More readers saved the visual" },
      },
    } as RenderedPanel,
  },
  {
    name: "dense editorial argument",
    expected: "essay",
    panel: {
      ...panel,
      sectionId: "genre-essay",
      heading: "A nuanced argument needs room for evidence and context",
      caption: "Long-form ideas become useful when the evidence, qualification, and practical consequence remain visible together.",
      copyOverrides: {
        primary:
          "A mature editorial panel should preserve the source's central claim, the evidence that supports it, the qualification that keeps it credible, and the practical consequence that gives the reader a reason to care. This deliberately longer passage verifies that dense argument-led material receives a reading-first composition instead of a generic diagram.",
        items: [],
      },
      plan: { ...flexiblePlan, visualType: "illustrative" as const },
    } as RenderedPanel,
  },
] as const;

for (const genreCase of genreAwareCases) {
  const chosen = chooseAdaptivePanelLayout(
    { ...genreCase.panel, layoutVariant: "auto" },
    2
  );
  if (chosen !== genreCase.expected) {
    throw new Error(`${genreCase.name}: expected ${genreCase.expected}, received ${chosen}`);
  }
  if (!panelLayoutCompatibility(genreCase.panel, chosen).compatible) {
    throw new Error(`${genreCase.name}: automatic ${chosen} layout is incompatible`);
  }
  if (suggestedPanelLayouts(genreCase.panel, 2)[0]?.id !== chosen) {
    throw new Error(`${genreCase.name}: strongest suggestion did not match automatic ${chosen}`);
  }
}
console.log("Verified genre-aware suggestions for careers, skills, annotations, statistics, and dense arguments.");

const flexiblePanels = Array.from({ length: 4 }, (_, index) => ({
  ...panel,
  sectionId: `flex-${index + 1}`,
  heading: `Flexible argument ${index + 1}`,
  layoutVariant: "auto" as const,
  plan: flexiblePlan,
})) as RenderedPanel[];
const resolvedSequence = chooseCarouselPanelLayouts(flexiblePanels);
if (resolvedSequence.some((layout, index) => index > 0 && layout === resolvedSequence[index - 1])) {
  throw new Error(`automatic carousel repeated adjacent flexible layouts: ${resolvedSequence.join(", ")}`);
}
const explicitPanels = flexiblePanels.map((candidate, index) =>
  index === 2 ? { ...candidate, layoutVariant: "essay" as const } : candidate
);
if (chooseCarouselPanelLayouts(explicitPanels)[2] !== "essay") {
  throw new Error("explicit per-panel layout was not preserved");
}
for (const candidate of flexiblePanels) {
  const primary = suggestedPanelLayouts(candidate, 1).slice(0, 3);
  if (primary.some((choice) => !panelLayoutCompatibility(candidate, choice.id).compatible)) {
    throw new Error("primary layout suggestions included an incompatible design");
  }
}
for (const [index, candidate] of flexiblePanels.entries()) {
  const automaticScene = createEditableTemplateScene({
    explainer: { ...explainer, panels: flexiblePanels },
    panel: candidate,
    panelIndex: index + 1,
    totalPanels: flexiblePanels.length,
    template: "adaptive-editorial",
  });
  const explicitCandidate = {
    ...candidate,
    layoutVariant: resolvedSequence[index],
  } as RenderedPanel;
  const explicitPanelsForScene = flexiblePanels.map((current, currentIndex) =>
    currentIndex === index ? explicitCandidate : current
  );
  const explicitScene = createEditableTemplateScene({
    explainer: { ...explainer, panels: explicitPanelsForScene },
    panel: explicitCandidate,
    panelIndex: index + 1,
    totalPanels: flexiblePanels.length,
    template: "adaptive-editorial",
  });
  if (renderEditableSceneSvg(automaticScene) !== renderEditableSceneSvg(explicitScene)) {
    throw new Error(`automatic preview and explicit canvas seed diverged for panel ${index + 1}`);
  }
}
console.log(`Verified content-aware carousel variety (${resolvedSequence.join(" → ")}) and compatible primary suggestions.`);
console.log("Verified automatic previews and canvas seeds resolve the same carousel-aware layout.");

const identitySequencePanels = [
  {
    ...panel,
    sectionId: "identity-sequence-hook",
    heading: "The question that changes the conversation",
    layoutVariant: "auto" as const,
    copyOverrides: {
      kicker: "The opening",
      primary: "A single clear idea should earn attention before the evidence begins.",
      items: [],
    },
    plan: { ...flexiblePlan, visualType: "insight" as const },
  },
  {
    ...stressPanel,
    sectionId: "identity-sequence-framework",
    heading: "Four decisions turn the idea into an operating system",
    layoutVariant: "auto" as const,
    plan: { ...flexiblePlan, visualType: "framework" as const },
  },
  {
    ...panel,
    sectionId: "identity-sequence-system",
    heading: "The parts work because the connections are visible",
    layoutVariant: "auto" as const,
    copyOverrides: {
      kicker: "The system",
      primary: "Source, evidence, story, and publishing form one connected workflow.",
      items: [],
    },
    plan: {
      ...flexiblePlan,
      visualType: "structural" as const,
      nodes: panel.plan!.nodes,
      edges: panel.plan!.edges,
    },
  },
  {
    ...panel,
    sectionId: "identity-sequence-evidence",
    heading: "The evidence moves in two directions",
    layoutVariant: "auto" as const,
    copyOverrides: {
      kicker: "The evidence",
      primary: "A compact data panel makes the change visible without losing the argument.",
      items: [],
    },
    plan: {
      ...flexiblePlan,
      visualType: "chart" as const,
      chart: panel.plan!.chart,
    },
  },
] as RenderedPanel[];

for (const template of matureIdentities) {
  const layouts = identitySequencePanels.map((candidate, index) => {
    const layout = chooseTemplatePanelLayout(
      identitySequencePanels,
      index + 1,
      candidate,
      template
    );
    const scene = createEditableTemplateScene({
      explainer: {
        ...explainer,
        panels: identitySequencePanels,
        template,
      },
      panel: candidate,
      panelIndex: index + 1,
      totalPanels: identitySequencePanels.length,
      template,
    });
    if (scene.readoppLayout !== layout) {
      throw new Error(
        `${template}: carousel preview and canvas seed disagreed on panel ${index + 1}`
      );
    }
    if (!panelLayoutCompatibility(candidate, layout).compatible) {
      throw new Error(`${template}: chose incompatible ${layout} for panel ${index + 1}`);
    }
    assertVisibleTextGeometry(`${template} sequence panel ${index + 1}`, scene);
    return layout;
  });
  if (layouts.some((layout, index) => index > 0 && layout === layouts[index - 1])) {
    throw new Error(`${template}: repeated adjacent carousel layouts (${layouts.join(" → ")})`);
  }
  if (new Set(layouts).size < 3) {
    throw new Error(`${template}: carousel rhythm collapsed to ${layouts.join(" → ")}`);
  }
  if (layouts[2] !== "architecture") {
    throw new Error(`${template}: system structure lost its architecture composition`);
  }
  if (layouts[3] !== "diverging") {
    throw new Error(`${template}: positive/negative evidence lost its diverging composition`);
  }
  console.log(`${template.padEnd(19)} carousel rhythm ${layouts.join(" → ")}`);
}
console.log("Verified full-story composition rhythm, compatibility, and editable bounds across every mature identity.");

const plainSvg = '<svg viewBox="0 0 1080 1080"><text>Editable</text></svg>';
const overriddenSvg = markCanvasOverride(plainSvg);
if (!isCanvasOverride(overriddenSvg)) throw new Error("canvas override marker was not added");
const templateManagedSvg = clearCanvasOverride(overriddenSvg);
if (isCanvasOverride(templateManagedSvg) || templateManagedSvg !== plainSvg) {
  throw new Error("canvas override marker was not cleanly removed");
}
console.log("Verified reversible canvas-to-template layout handoff.");

if (!usesRenderedTemplateSeed(panel, "adaptive-editorial")) {
  throw new Error("template-managed panel did not request its editable native seed");
}
const canvasPanel = { ...panel, content: overriddenSvg } as RenderedPanel;
if (usesRenderedTemplateSeed(canvasPanel, "adaptive-editorial")) {
  throw new Error("canvas-authored panel attempted to replace its saved scene with a template seed");
}
const seedVersions = new Set([
  canvasSeedVersion(panel, "adaptive-editorial", "cover"),
  canvasSeedVersion({ ...panel, layoutVariant: "essay" }, "adaptive-editorial", "essay"),
  canvasSeedVersion({ ...panel, themeColor: "#123456" }, "adaptive-editorial", "cover"),
  canvasSeedVersion({ ...panel, heading: `${panel.heading} revised` }, "adaptive-editorial", "cover"),
  canvasSeedVersion({ ...panel, content: "<svg><text>Changed</text></svg>" }, "adaptive-editorial", "cover"),
]);
if (seedVersions.size !== 5) {
  throw new Error("canvas seed version did not invalidate every visible panel design change");
}
console.log("Verified saved canvas scenes survive as overrides and stale scenes invalidate after visible layout changes.");

const matureRecommendationIds = new Set([
  "adaptive-editorial",
  "editorial-report",
  "modern-technical",
  "data-story",
  "bold-social",
] as const);
const contentFeatures = (overrides: Partial<{
  hasNumericData: boolean;
  hasDates: boolean;
  hasCharts: boolean;
  hasCode: boolean;
  hasRoles: boolean;
  hasSkills: boolean;
  hasFigures: boolean;
}> = {}) => ({
  hasNumericData: false,
  hasDates: false,
  hasCharts: false,
  hasCode: false,
  hasRoles: false,
  hasSkills: false,
  hasFigures: false,
  ...overrides,
});
const recommendationFixture = (
  overrides: Partial<Explainer>,
  visualType: NonNullable<RenderedPanel["plan"]>["visualType"]
) => ({
  ...explainer,
  ...overrides,
  panels: [
    {
      ...panel,
      plan: { ...panel.plan!, visualType },
    },
  ],
}) as Explainer;

const generalRanking = recommendTemplates(
  recommendationFixture({}, "insight"),
  {},
  matureRecommendationIds
);
if (generalRanking[0]?.id !== "adaptive-editorial") {
  throw new Error("general story did not receive adaptive editorial as its safe first recommendation");
}

const technicalRanking = recommendTemplates(
  recommendationFixture({ audienceLevel: "technical" }, "structural"),
  {
    genre: "documentation",
    requestedStyle: "clean",
    contentFeatures: contentFeatures({ hasCode: true }),
  },
  matureRecommendationIds
);
if (technicalRanking[0]?.id !== "modern-technical") {
  throw new Error(`technical documentation ranked ${technicalRanking[0]?.id ?? "nothing"} first`);
}

const dataRanking = recommendTemplates(
  recommendationFixture(
    { audienceLevel: "professional", publishingGoal: "key_findings" },
    "chart"
  ),
  {
    genre: "whitepaper",
    contentFeatures: contentFeatures({ hasNumericData: true, hasCharts: true }),
  },
  matureRecommendationIds
);
const dataLeaders = new Set(dataRanking.slice(0, 2).map((item) => item.id));
if (!dataLeaders.has("data-story") || !dataLeaders.has("editorial-report")) {
  throw new Error(`data-heavy story leaders were ${[...dataLeaders].join(", ")}`);
}

const boldRanking = recommendTemplates(
  recommendationFixture({ publishingGoal: "start_discussion" }, "insight"),
  { requestedStyle: "bold", contentFeatures: contentFeatures() },
  matureRecommendationIds
);
if (boldRanking[0]?.id !== "bold-social") {
  throw new Error(`discussion-led story ranked ${boldRanking[0]?.id ?? "nothing"} first`);
}
const careerRanking = recommendTemplates(
  {
    ...explainer,
    audienceLevel: "professional",
    panels: [genreAwareCases[0].panel],
  },
  {
    genre: "resume",
    contentFeatures: contentFeatures({ hasDates: true, hasRoles: true }),
  },
  matureRecommendationIds
);
if (careerRanking[0]?.id !== "editorial-report") {
  throw new Error(`career story ranked ${careerRanking[0]?.id ?? "nothing"} first`);
}

const skillsRanking = recommendTemplates(
  {
    ...explainer,
    audienceLevel: "professional",
    panels: [genreAwareCases[1].panel],
  },
  {
    genre: "resume",
    contentFeatures: contentFeatures({ hasSkills: true }),
  },
  matureRecommendationIds
);
if (skillsRanking[0]?.id !== "modern-technical") {
  throw new Error(`skills story ranked ${skillsRanking[0]?.id ?? "nothing"} first`);
}

for (const recommendation of [
  technicalRanking[0],
  dataRanking[0],
  boldRanking[0],
  careerRanking[0],
  skillsRanking[0],
]) {
  if (
    !recommendation ||
    /mature content-led publishing system/i.test(recommendation.reason) ||
    recommendation.signal.length < 20 ||
    recommendation.outcome.length < 20
  ) {
    throw new Error("a contextual recommendation exposed only a generic maturity rationale");
  }
  if (
    !recommendation.signal.includes(explainer.title) &&
    !recommendation.signal.includes(panel.heading)
  ) {
    throw new Error("a contextual recommendation did not cite the actual story or panel");
  }
}
const matureOutcomes = new Set(
  recommendTemplates(recommendationFixture({}, "insight"), {}, matureRecommendationIds)
    .map((recommendation) => recommendation.outcome)
);
if (matureOutcomes.size !== matureRecommendationIds.size) {
  throw new Error("mature template recommendations did not explain distinct visual outcomes");
}
console.log(
  `Verified content-led template ranking: general → ${generalRanking[0].id}, technical → ${technicalRanking[0].id}, data → ${dataRanking
    .slice(0, 2)
    .map((item) => item.id)
    .join(" / ")}, discussion → ${boldRanking[0].id}, career → ${careerRanking[0].id}, skills → ${skillsRanking[0].id}.`
);
