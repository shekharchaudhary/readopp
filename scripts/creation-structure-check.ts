import { buildEditorialBrief } from "../lib/editorialBrief";
import {
  ComprehensionSchema,
  EditorialBriefSchema,
  type Comprehension,
} from "../lib/shared/schemas";
import {
  effectivePanelCountRange,
  panelCountRangeLabel,
  recommendedPanelCountRange,
} from "../lib/storyLength";

const baseComprehension = ComprehensionSchema.parse({
  oneLineSummary: "Protected focus makes collaboration more reliable.",
  coreIdea: "Teams need a shared availability rhythm, not constant interruption.",
  keyClaims: [
    "One protected work block preserves difficult decision-making.",
    "Predictable response windows make coordination visible.",
    "A narrow escalation path preserves urgency without constant monitoring.",
  ],
  entities: [],
  jargon: [],
  narrativeArc: "Problem, evidence, and a practical operating rhythm.",
  audienceLevel: "professional",
  genre: "article",
  genreConfidence: "high",
  contentFeatures: {},
  dataSeries: [],
});

function withEvidence(pointCount: number): Comprehension {
  return ComprehensionSchema.parse({
    ...baseComprehension,
    contentFeatures: {
      ...baseComprehension.contentFeatures,
      hasNumericData: true,
      hasCharts: true,
    },
    dataSeries: [
      {
        name: "Useful capacity",
        unit: "%",
        points: Array.from({ length: pointCount }, (_, index) => ({
          label: `Window ${index + 1}`,
          value: 100 - index * 6,
        })),
      },
    ],
  });
}

function expectRange(
  label: string,
  comprehension: Comprehension,
  words: number,
  min: number,
  max: number
) {
  const range = recommendedPanelCountRange(comprehension, words);
  if (range.min !== min || range.max !== max) {
    throw new Error(
      `${label}: expected ${min}–${max}, received ${range.min}–${range.max}`
    );
  }
  if (!range.reason || range.reason.length < 12) {
    throw new Error(`${label}: story-length decision has no useful reason`);
  }
  console.log(`${label.padEnd(28)} ${panelCountRangeLabel(range)} · ${range.reason}`);
}

expectRange("single focused note", baseComprehension, 180, 1, 2);
expectRange("short article", baseComprehension, 620, 2, 3);
expectRange("medium argument", baseComprehension, 1_250, 3, 4);
expectRange("deep source", baseComprehension, 2_600, 4, 5);
expectRange("compact evidence source", withEvidence(10), 220, 3, 4);
expectRange("short chart-led source", withEvidence(4), 620, 2, 3);
expectRange(
  "substantial research",
  { ...baseComprehension, genre: "research_paper" },
  1_100,
  3,
  4
);

const unknown = recommendedPanelCountRange(baseComprehension, 0);
if (unknown.min !== 1 || unknown.max !== 5) {
  throw new Error("older sources without a word count lost the safe 1–5 range");
}

const exactOverride = effectivePanelCountRange(
  recommendedPanelCountRange(baseComprehension, 620),
  5
);
if (exactOverride.min !== 5 || exactOverride.max !== 5) {
  throw new Error("an exact creator choice did not override the recommendation");
}

const brief = EditorialBriefSchema.parse(
  buildEditorialBrief({
    article: {
      url: "fixture://creation-structure",
      title: "Designing calmer collaboration",
      text: "A source fixture.",
      wordCount: 620,
      codeBlocks: [],
      imageUrls: [],
    },
    comprehension: baseComprehension,
    audience: "professional",
    publishingGoal: "teach",
  })
);
if (
  brief.storyLength?.min !== 2 ||
  brief.storyLength.max !== 3 ||
  brief.directions.length !== 3 ||
  !brief.directions.some(
    (direction) => direction.id === brief.selectedDirectionId
  )
) {
  throw new Error("the creation review lost its story-length or angle decision");
}

console.log("Verified the creation brief exposes a grounded story angle and dynamic panel budget.");
