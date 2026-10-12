import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  AudienceLevel,
  BrandStyle,
  ContentFeatures,
  EditorialBrief,
  Explainer,
  Genre,
  PublishingGoal,
  RenderedPanel,
} from "@/lib/shared/schemas";
import { completeJob, createJob, emitEvent, updateJob } from "@/lib/store";
import { getOrCreateUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXTURE_HEADER = "mobile-editor-flow-v1";
const FIXTURE_TITLE = "Designing calmer collaboration";

type RecommendationProfile =
  | "general"
  | "research"
  | "data"
  | "technical"
  | "discussion";

interface RecommendationProfileConfig {
  audienceLevel: AudienceLevel;
  style: BrandStyle;
  publishingGoal: PublishingGoal;
  genre: Genre;
  contentFeatures: ContentFeatures;
}

const EMPTY_CONTENT_FEATURES: ContentFeatures = {
  hasNumericData: false,
  hasDates: false,
  hasCharts: false,
  hasCode: false,
  hasRoles: false,
  hasSkills: false,
  hasFigures: false,
};

const RECOMMENDATION_PROFILES: Record<
  RecommendationProfile,
  RecommendationProfileConfig
> = {
  general: {
    audienceLevel: "professional",
    style: "editorial",
    publishingGoal: "teach",
    genre: "article",
    contentFeatures: EMPTY_CONTENT_FEATURES,
  },
  research: {
    audienceLevel: "professional",
    style: "editorial",
    publishingGoal: "make_argument",
    genre: "research_paper",
    contentFeatures: {
      ...EMPTY_CONTENT_FEATURES,
      hasNumericData: true,
      hasCharts: true,
      hasFigures: true,
    },
  },
  data: {
    audienceLevel: "professional",
    style: "clean",
    publishingGoal: "key_findings",
    genre: "whitepaper",
    contentFeatures: {
      ...EMPTY_CONTENT_FEATURES,
      hasNumericData: true,
      hasCharts: true,
    },
  },
  technical: {
    audienceLevel: "technical",
    style: "clean",
    publishingGoal: "teach",
    genre: "documentation",
    contentFeatures: {
      ...EMPTY_CONTENT_FEATURES,
      hasCode: true,
    },
  },
  discussion: {
    audienceLevel: "general",
    style: "bold",
    publishingGoal: "teach",
    genre: "article",
    contentFeatures: EMPTY_CONTENT_FEATURES,
  },
};

function recommendationProfile(value: unknown): RecommendationProfile {
  return typeof value === "string" && value in RECOMMENDATION_PROFILES
    ? (value as RecommendationProfile)
    : "general";
}

function panel(
  sectionId: string,
  heading: string,
  caption: string,
  plan: NonNullable<RenderedPanel["plan"]>
): RenderedPanel {
  return {
    sectionId,
    heading,
    caption,
    format: "svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480"><rect width="680" height="480" fill="#F5F2EA"/><path d="M72 392H608" stroke="#101010" stroke-width="2"/></svg>',
    validated: true,
    fallback: false,
    edited: false,
    layoutVariant: "auto",
    plan,
  };
}

export async function POST(request: Request) {
  // This route exists only to make the complete local editor flow
  // deterministic. Production always returns 404, even if the header leaks.
  if (
    process.env.NODE_ENV === "production" ||
    request.headers.get("x-readopp-e2e") !== FIXTURE_HEADER
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { userId } = await getOrCreateUser();
  const body = await request.json().catch(() => ({}));
  const profile = recommendationProfile(body?.profile);
  const profileConfig = RECOMMENDATION_PROFILES[profile];
  const job = await createJob({
    url: "fixture://mobile-editor",
    audienceLevel: profileConfig.audienceLevel,
    style: profileConfig.style,
    publishingGoal: profileConfig.publishingGoal,
    voiceProfileId: "clear_expert",
    userId,
    cacheKey: `e2e-mobile-editor:${randomUUID()}`,
  });
  if (body?.stage === "brief") {
    const brief: EditorialBrief = {
      sourceTitle: FIXTURE_TITLE,
      sourceSummary:
        "A concise operating system for reliable coordination without continuous interruption.",
      audience: "professional",
      publishingGoal: "teach",
      storyLength: {
        min: 2,
        max: 3,
        reason: "This short source needs one focused story arc.",
      },
      directions: [
        {
          id: "essential",
          name: "Essential insight",
          hook: "Protect difficult work without making collaboration disappear.",
          angle: "Explain one shared rhythm, then show why it improves both focus and response reliability.",
          outcome: "Make the central idea easy to understand and remember.",
        },
        {
          id: "evidence",
          name: "Evidence first",
          hook: "Every interruption spends capacity the team cannot recover immediately.",
          angle: "Lead with the measurable cost, then show the operating response.",
          outcome: "Give skeptical readers a credible, source-grounded reason to care.",
        },
        {
          id: "action",
          name: "Consequence & action",
          hook: "Constant availability is a coordination design problem, not a personal discipline problem.",
          angle: "Make the consequence visible, then give the team a practical next move.",
          outcome: "Turn the source's consequence into a specific, useful action.",
        },
      ],
      selectedDirectionId: "essential",
    };
    await updateJob(job.id, {
      status: "awaiting_approval",
      editorialBrief: brief,
      briefApproved: false,
    });
    await emitEvent(job.id, {
      type: "job.status",
      data: { status: "awaiting_approval" },
    });
    await emitEvent(job.id, { type: "brief.ready", data: { brief } });
    return NextResponse.json(
      { jobId: job.id, title: FIXTURE_TITLE, stage: "brief" },
      { status: 201 }
    );
  }
  const explainerId = randomUUID();
  const now = new Date().toISOString();
  const panels: RenderedPanel[] = [
    panel(
      "protect-focus",
      "Protect the work that needs depth",
      "One uninterrupted block gives difficult decisions enough room to become clear.",
      {
        sectionId: "protect-focus",
        visualType: "key_findings",
        caption:
          "One uninterrupted block gives difficult decisions enough room to become clear.",
        narrativeReason: "Three concrete findings benefit from a ranked editorial layout.",
        keyFindings: {
          label: "A calmer operating rhythm",
          findings: [
            { title: "Protect", detail: "Reserve one block for difficult work." },
            { title: "Batch", detail: "Open routine messages at predictable times." },
            { title: "Escalate", detail: "Keep one narrow path for genuine urgency." },
          ],
        },
      }
    ),
    panel(
      "shared-rhythm",
      "Turn availability into a shared system",
      "Coordination becomes reliable when expectations are visible to everyone.",
      {
        sectionId: "shared-rhythm",
        visualType: "framework",
        caption:
          "Coordination becomes reliable when expectations are visible to everyone.",
        narrativeReason: "A sequence communicates the operating model more clearly than prose.",
        framework: {
          label: "The collaboration loop",
          steps: [
            { name: "Choose", description: "Name the work that needs depth." },
            { name: "Protect", description: "Block the time visibly." },
            { name: "Respond", description: "Batch normal communication." },
            { name: "Review", description: "Adjust the rhythm together." },
          ],
        },
      }
    ),
    panel(
      "less-switching",
      "Less switching preserves useful capacity",
      "A simple comparison makes the cost of interruption visible.",
      {
        sectionId: "less-switching",
        visualType: "chart",
        caption: "A simple comparison makes the cost of interruption visible.",
        narrativeReason: "Comparable numeric values are strongest as a compact chart.",
        chart: {
          kind: "bar",
          title: "Useful capacity",
          unit: "%",
          series: [
            {
              name: "Capacity",
              points: [
                { label: "Protected block", value: 100 },
                { label: "Light switching", value: 82 },
                { label: "Heavy switching", value: 60 },
              ],
            },
          ],
        },
      }
    ),
  ];
  const explainer: Explainer = {
    id: explainerId,
    jobId: job.id,
    url: "fixture://mobile-editor",
    title: FIXTURE_TITLE,
    summary:
      "A concise operating system for reliable coordination without continuous interruption.",
    audienceLevel: profileConfig.audienceLevel,
    publishingGoal: profileConfig.publishingGoal,
    voiceProfileId: "clear_expert",
    template: "adaptive-editorial",
    panels,
    createdAt: now,
    updatedAt: now,
  };

  await updateJob(job.id, {
    pipelineState: {
      article: {
        url: "fixture://mobile-editor",
        title: FIXTURE_TITLE,
        text:
          profile === "technical"
            ? "A documented system with typed interfaces, code examples, and explicit component boundaries."
            : "A source-grounded explanation of calmer collaboration, measurable capacity, and reliable team rhythms.",
        codeBlocks:
          profile === "technical"
            ? ["type CollaborationLoop = { protect: boolean; respondAt: Date }"]
            : [],
        imageUrls: [],
        wordCount: 120,
      },
      comprehension: {
        oneLineSummary:
          "A concise operating system for reliable coordination without continuous interruption.",
        coreIdea:
          "Shared response rhythms preserve focus while keeping coordination dependable.",
        keyClaims: [
          "Predictable response windows reduce switching without hiding urgent work.",
        ],
        entities: [],
        jargon: [],
        narrativeArc: "Cost, operating model, evidence, and practical response.",
        audienceLevel: profileConfig.audienceLevel,
        genre: profileConfig.genre,
        genreConfidence: "high",
        contentFeatures: profileConfig.contentFeatures,
        dataSeries:
          profile === "research" || profile === "data"
            ? [
                {
                  name: "Useful capacity",
                  unit: "%",
                  points: [
                    { label: "Protected block", value: 100 },
                    { label: "Heavy switching", value: 60 },
                  ],
                },
              ]
            : [],
      },
    },
  });
  await completeJob(job.id, explainer);
  let eventEmitted = true;
  try {
    await emitEvent(job.id, {
      type: "job.completed",
      data: { explainer },
    });
  } catch {
    // The fixture remains usable when local realtime/event persistence is
    // temporarily unavailable. The job and explainer are already complete,
    // and returning their exact IDs lets the test continue and clean up
    // safely instead of timing out with orphaned rows.
    eventEmitted = false;
  }
  return NextResponse.json(
    {
      jobId: job.id,
      explainerId,
      title: FIXTURE_TITLE,
      eventEmitted,
      profile,
      panelCount: panels.length,
    },
    { status: 201 }
  );
}
