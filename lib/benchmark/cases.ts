import type { PublishingGoal, TemplateId } from "../shared/schemas";

export const BENCHMARK_SOURCES = [
  { id: "business", label: "Business article", title: "Why Great Teams Protect Focus", heading: "Attention compounds when you protect it", caption: "Teams that preserve uninterrupted focus make better decisions with less recovery time." },
  { id: "research", label: "Research paper", title: "Retrieval Systems Under Distribution Shift", heading: "Benchmarks hide the hardest retrieval failures", caption: "Average accuracy stays stable while rare, consequential queries deteriorate first." },
  { id: "technical", label: "Technical essay", title: "Designing Durable Event Streams", heading: "Replayability is a product feature", caption: "Persisted events let every client reconstruct state without trusting one server process." },
  { id: "newsletter", label: "Newsletter", title: "The Quiet Return of Small Communities", heading: "Smaller audiences create stronger signals", caption: "The most useful communities optimize for repeated trust rather than maximum reach." },
  { id: "opinion", label: "Founder opinion", title: "Your Roadmap Is Not a Strategy", heading: "More features will not rescue weak positioning", caption: "A focused promise creates more leverage than a longer list of capabilities." },
] as const;

export const BENCHMARK_TEMPLATES: TemplateId[] = [
  "aurora-glass", "bento-grid", "swiss-poster", "editorial-broadsheet", "sticky-notes",
];

export const BENCHMARK_GOALS: PublishingGoal[] = ["teach", "key_findings", "make_argument"];

export const BENCHMARK_CASES = BENCHMARK_SOURCES.flatMap((source) =>
  BENCHMARK_TEMPLATES.flatMap((template) =>
    BENCHMARK_GOALS.map((goal) => ({ id: `${source.id}:${template}:${goal}`, source, template, goal }))
  )
);

export const REVIEW_CRITERIA = [
  ["publish", "I would publish this without redesigning it"],
  ["clarity", "The main idea is clear within five seconds"],
  ["necessity", "Every visible element earns its place"],
  ["credibility", "It feels credible rather than AI-generated"],
  ["accuracy", "The source is represented accurately"],
  ["caption", "The caption supports the publishing goal"],
  ["format", "The composition fits the export format"],
] as const;
