import type { CleanArticle, Comprehension, Explainer, ExplainerOutline, PanelPlan, RenderedPanel, SocialPack } from "../shared/schemas";

export const HARNESS_VERSION = "1.0.0";

export const articleFixture: CleanArticle = {
  url: "https://example.com/durable-streams",
  title: "Designing Durable Event Streams",
  byline: "Readopp Harness",
  text: "Persisting events lets clients reconnect without losing progress. A replayable event log separates job execution from the browser connection. Teams should make every event ordered and idempotent.",
  codeBlocks: [], imageUrls: [], wordCount: 29,
};

export const comprehensionFixture: Comprehension = {
  oneLineSummary: "Persisted, replayable events make long-running jobs resilient to disconnected clients.",
  coreIdea: "Durability is a product feature: clients can reconstruct progress from an ordered event log.",
  keyClaims: [
    "Persisted events let clients reconnect without losing progress.",
    "A replayable event log separates job execution from the browser connection.",
    "Ordered, idempotent events make state reconstruction reliable.",
  ],
  entities: [{ name: "event log", kind: "concept", note: "durable progress record" }],
  jargon: [{ term: "idempotent", plainDefinition: "safe to apply more than once" }],
  narrativeArc: "Problem, durable mechanism, implementation rule.",
  audienceLevel: "professional", genre: "documentation", genreConfidence: "high",
  contentFeatures: { hasNumericData: false, hasDates: false, hasCharts: false, hasCode: false, hasRoles: false, hasSkills: false, hasFigures: false },
  dataSeries: [],
};

export const outlineFixture: ExplainerOutline = {
  title: "Durability is a product feature",
  sections: [
    { id: "s1", heading: "The fragile default", intent: "Frame the problem", visualType: "insight", sourceClaimIndexes: [0] },
    { id: "s2", heading: "Persist, then replay", intent: "Explain the mechanism", visualType: "flowchart", sourceClaimIndexes: [1] },
    { id: "s3", heading: "Make replay safe", intent: "Give the rule", visualType: "key_findings", sourceClaimIndexes: [2] },
  ],
};

export const planFixture: PanelPlan = {
  sectionId: "s1", visualType: "insight",
  caption: "A reconnect should resume the story, not restart it.",
  insight: { text: "Durability is a product feature.", kicker: "THE INSIGHT", attribution: "Designing Durable Event Streams" },
  narrativeReason: "A single thesis deserves a focused opening panel.",
};

export const renderedFixture: RenderedPanel = {
  sectionId: "s1", heading: "The fragile default", caption: planFixture.caption,
  format: "svg", content: '<svg viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg"><title>Durability</title><text x="40" y="80">Durability is a product feature.</text></svg>',
  validated: true, fallback: false, plan: planFixture, edited: false,
};

export const explainerFixture: Explainer = {
  id: "harness-explainer", jobId: "harness-job", url: articleFixture.url,
  title: outlineFixture.title, summary: comprehensionFixture.oneLineSummary,
  audienceLevel: "professional", publishingGoal: "teach", voiceProfileId: "clear_expert",
  panels: [renderedFixture], createdAt: "2026-01-01T00:00:00.000Z",
  evidenceMap: { claimCount: 3, coveredClaimCount: 3, coveragePercent: 100, panels: outlineFixture.sections.map((s) => ({ sectionId: s.id, heading: s.heading, claims: s.sourceClaimIndexes.map((i) => comprehensionFixture.keyClaims[i]), grounded: true })) },
};

export const socialFixture: SocialPack = {
  caption: "A durable event stream is more than infrastructure—it is what lets the product recover gracefully.",
  hashtags: ["eventdriven", "reliability", "softwarearchitecture"],
  altTexts: [{ sectionId: "s1", text: "Editorial panel stating that durability is a product feature." }],
  sourceAttribution: "Read at example.com",
  poll: {
    question: "What makes a long-running workflow feel most reliable?",
    options: ["Replayable progress", "Faster execution", "More notifications", "Fewer steps"],
    intro: "Reliability is not only uptime. It is whether a user can leave, return, and still trust the state they see.",
    followUp: "Once the poll closes, compare the leading answer with the source's argument for persisted, replayable events.",
    sourceClaimIndexes: [0, 1],
  },
  documentAd: {
    documentTitle: "The durable workflow field guide",
    adIntro: "What happens when a long-running workflow is interrupted? This visual guide explains the design choices that preserve trust.",
    headline: "Build workflows users can return to",
    description: "A concise, evidence-grounded guide to durable progress and recovery.",
    formHeadline: "Get the durable workflow guide",
    formDetails: "Download the visual explainer and use it to review your own long-running product flows.",
    cta: "download",
    thankYouMessage: "Your guide is ready. Start with the recovery checklist on the final card.",
    followUpMessage: "Thanks for reading. Which part of workflow recovery creates the most friction in your product today?",
    sourceClaimIndexes: [0, 1],
  },
  conversationAd: {
    openingMessage: "Long-running work often fails at the moment a user reconnects. Which part of durable recovery would be most useful to you?",
    senderGuidance: "Send from a product or engineering leader who can answer implementation questions credibly.",
    branches: [
      { id: "learn", choice: "Understand the model", response: "Start with the visual explanation of why replayable progress is a product capability.", nextStep: "Open the explainer.", cta: "read_explainer" },
      { id: "apply", choice: "Apply it to my team", response: "Use the guide to review how your product persists and restores long-running work.", nextStep: "Download the field guide.", cta: "download_document" },
    ],
    noResponseFollowUp: "Sharing this once more in case workflow recovery is on your roadmap. The explainer is available whenever it is useful.",
    sourceClaimIndexes: [0, 1],
  },
  newsletterSeries: {
    seriesTitle: "Designing workflows people can trust",
    positioning: "A three-part field series on durable progress, recovery, and the product decisions behind them.",
    cadence: "weekly",
    issues: [
      { issueNumber: 1, subject: "Durability is a product feature", previewText: "Why recovery belongs in the user experience.", headline: "The hidden product promise in long-running work", opening: "A workflow is not trustworthy merely because it starts quickly.", sections: [{ heading: "The fragile default", takeaway: "Ephemeral progress disappears when the connection does." }, { heading: "The product promise", takeaway: "Persisted events allow a returning user to recover state." }], cta: "Review one long-running flow in your product", sourceClaimIndexes: [0, 1] },
      { issueNumber: 2, subject: "Audit your recovery path", previewText: "A practical way to evaluate reconnect behavior.", headline: "What happens when the user comes back?", opening: "The fastest way to expose a fragile workflow is to interrupt it deliberately.", sections: [{ heading: "Test the interruption", takeaway: "Disconnect mid-flow and observe what state survives." }, { heading: "Replay the truth", takeaway: "Use persisted events to reconstruct progress consistently." }], cta: "Run the recovery test with your team", sourceClaimIndexes: [1, 2] },
      { issueNumber: 3, subject: "Trust compounds after the reconnect", previewText: "Turn recovery mechanics into a product advantage.", headline: "Recovery is where reliability becomes visible", opening: "Users experience architecture through the moments when something goes wrong.", sections: [{ heading: "Make progress legible", takeaway: "Show recovered state clearly instead of silently restarting." }, { heading: "Design for return", takeaway: "Treat a reconnect as a normal journey, not an edge case." }], cta: "Share the interactive explainer", sourceClaimIndexes: [0, 2] },
    ],
  },
};

export const regeneratedPlanFixture: PanelPlan = {
  ...planFixture,
  caption: "Reconnect without losing the reader's place.",
  narrativeReason: "Shortened the caption while preserving the source-backed thesis.",
};
