import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const agents = ["ingest", "comprehension", "structure", "planner", "render", "assembly", "social", "regenerate"];
const requested = process.argv[2] || "all";
if (process.argv.includes("--live")) throw new Error("Live model evaluation is intentionally separate from the deterministic CI harness. Use scripts/smoke-test-pipeline.ts after setting an explicit token budget.");
const selected = requested === "all" ? agents : agents.includes(requested) ? [requested] : [];
if (!selected.length) throw new Error(`Unknown agent '${requested}'. Choose ${agents.join(", ")} or all.`);

const fixtures = {
  ingest: { url: "https://example.com/durable-streams", title: "Designing Durable Event Streams", text: "Persisted event logs let clients reconnect and reconstruct long-running job progress without coupling execution to one browser connection.", wordCount: 21, codeBlocks: [], imageUrls: [] },
  comprehension: { oneLineSummary: "Replayable events make long-running jobs resilient.", coreIdea: "Durability lets clients reconstruct progress.", keyClaims: ["Persisted events survive client disconnection.", "Replay separates execution from browser connections.", "Ordered idempotent events reconstruct state safely."], audienceLevel: "professional", genre: "documentation", contentFeatures: { hasNumericData: false }, dataSeries: [] },
  structure: { title: "Durability is a product feature", sections: [{ id: "s1", heading: "The fragile default", intent: "Frame the problem", visualType: "insight", sourceClaimIndexes: [0] }, { id: "s2", heading: "Persist then replay", intent: "Explain the mechanism", visualType: "flowchart", sourceClaimIndexes: [1] }, { id: "s3", heading: "Make replay safe", intent: "Give the rule", visualType: "key_findings", sourceClaimIndexes: [2] }] },
  planner: { sectionId: "s1", visualType: "insight", caption: "A reconnect should resume the story, not restart it.", narrativeReason: "A single thesis deserves a focused opening panel.", insight: { text: "Durability is a product feature." } },
  render: { sectionId: "s1", heading: "The fragile default", caption: "A reconnect should resume the story.", format: "svg", content: '<svg viewBox="0 0 680 680"><text x="40" y="80">Durability is a product feature.</text></svg>', validated: true, fallback: false, plan: { sectionId: "s1" } },
  assembly: { id: "harness-explainer", title: "Durability is a product feature", panels: [{ sectionId: "s1" }], evidenceMap: { panels: [{ sectionId: "s1", grounded: true }] } },
  social: { caption: "A durable event stream is a product capability, not merely infrastructure.", hashtags: ["reliability", "eventdriven"], altTexts: [{ sectionId: "s1", text: "Panel explaining durable event streams." }], sourceAttribution: "Read at example.com", poll: { question: "What makes long-running work feel reliable?", options: ["Replayable progress", "Faster execution"], intro: "Reliability includes recovery.", followUp: "Compare the result with the source's argument.", sourceClaimIndexes: [0] }, documentAd: { documentTitle: "The durable workflow field guide", adIntro: "See how durable progress improves recovery.", headline: "Build workflows users trust", description: "A concise guide to durable progress.", formHeadline: "Get the workflow guide", formDetails: "Download the visual explainer and review your recovery flow.", cta: "download", thankYouMessage: "Your guide is ready.", followUpMessage: "Which recovery challenge matters most to your team?", sourceClaimIndexes: [0] }, conversationAd: { openingMessage: "Which part of durable recovery would help your team?", senderGuidance: "Send from a credible product leader.", branches: [{ id: "learn", choice: "Understand the model", response: "Open the visual explanation.", nextStep: "Read the explainer.", cta: "read_explainer" }, { id: "apply", choice: "Apply it", response: "Use the practical field guide.", nextStep: "Download the document.", cta: "download_document" }], noResponseFollowUp: "Sharing once more in case recovery is on your roadmap.", sourceClaimIndexes: [0] } },
  regenerate: { sectionId: "s1", visualType: "insight", caption: "Reconnect without losing the reader's place.", narrativeReason: "Shortened the caption while preserving the thesis." },
};

const contracts = {
  ingest: z.object({ url: z.string().url(), title: z.string().min(1), text: z.string().min(80), wordCount: z.number().int().positive(), codeBlocks: z.array(z.string()), imageUrls: z.array(z.string()) }),
  comprehension: z.object({ oneLineSummary: z.string().min(1).max(220), coreIdea: z.string().min(1), keyClaims: z.array(z.string().min(20)).min(3), audienceLevel: z.string(), genre: z.string(), contentFeatures: z.object({ hasNumericData: z.boolean() }), dataSeries: z.array(z.unknown()) }),
  structure: z.object({ title: z.string().min(1), sections: z.array(z.object({ id: z.string(), heading: z.string(), intent: z.string(), visualType: z.string(), sourceClaimIndexes: z.array(z.number().int().nonnegative()) })).min(3).max(6) }),
  planner: z.object({ sectionId: z.string(), visualType: z.string(), caption: z.string().min(20).max(600), narrativeReason: z.string().min(20) }),
  render: z.object({ sectionId: z.string(), format: z.enum(["svg", "html"]), content: z.string().min(20), validated: z.literal(true), plan: z.object({ sectionId: z.string() }) }),
  assembly: z.object({ id: z.string(), title: z.string(), panels: z.array(z.object({ sectionId: z.string() })).min(1), evidenceMap: z.object({ panels: z.array(z.object({ sectionId: z.string(), grounded: z.boolean() })) }) }),
  social: z.object({ caption: z.string().min(1).max(600), hashtags: z.array(z.string().regex(/^[^#\s]+$/)).max(5), altTexts: z.array(z.object({ sectionId: z.string(), text: z.string().min(1).max(200) })), sourceAttribution: z.string().max(200), poll: z.object({ question: z.string().max(140), options: z.array(z.string().max(30)).min(2).max(4), intro: z.string(), followUp: z.string(), sourceClaimIndexes: z.array(z.number().int().nonnegative()).min(1) }), documentAd: z.object({ documentTitle: z.string().max(70), adIntro: z.string().max(600), headline: z.string().max(200), description: z.string().max(300), formHeadline: z.string().max(60), formDetails: z.string().max(160), cta: z.enum(["download", "learn_more", "sign_up", "get_quote"]), thankYouMessage: z.string().max(300), followUpMessage: z.string().max(800), sourceClaimIndexes: z.array(z.number().int().nonnegative()).min(1) }), conversationAd: z.object({ openingMessage: z.string().max(500), senderGuidance: z.string().max(300), branches: z.array(z.object({ id: z.string(), choice: z.string().max(40), response: z.string().max(500), nextStep: z.string().max(220), cta: z.enum(["read_explainer", "download_document", "read_source", "start_conversation"]) })).min(2).max(4), noResponseFollowUp: z.string().max(500), sourceClaimIndexes: z.array(z.number().int().nonnegative()).min(1) }) }),
  regenerate: z.object({ sectionId: z.literal("s1"), visualType: z.string(), caption: z.string().min(20), narrativeReason: z.string().min(20) }),
};

fixtures.social.newsletterSeries = {
  seriesTitle: "Designing workflows people can trust",
  positioning: "A three-part series on durable progress and recovery.",
  cadence: "weekly",
  issues: [1, 2, 3].map((issueNumber) => ({ issueNumber, subject: `Durable workflows, part ${issueNumber}`, previewText: "A practical lesson in recovery.", headline: `Recovery lesson ${issueNumber}`, opening: "Reliable workflows preserve progress when connections fail.", sections: [{ heading: "Principle", takeaway: "Persist events so progress can be reconstructed." }, { heading: "Practice", takeaway: "Test reconnect behavior as part of the user journey." }], cta: "Review your recovery path", sourceClaimIndexes: [0] })),
};
contracts.social = contracts.social.extend({
  newsletterSeries: z.object({ seriesTitle: z.string().max(80), positioning: z.string().max(300), cadence: z.enum(["three_days", "weekly", "biweekly"]), issues: z.array(z.object({ issueNumber: z.number().int().min(1).max(3), subject: z.string().max(100), previewText: z.string().max(140), headline: z.string().max(120), opening: z.string().max(500), sections: z.array(z.object({ heading: z.string().max(80), takeaway: z.string().max(400) })).min(2).max(4), cta: z.string().max(160), sourceClaimIndexes: z.array(z.number().int().nonnegative()).min(1) })).length(3) }),
});

function semantic(agent, value) {
  if (agent === "comprehension") return !value.contentFeatures.hasNumericData || value.dataSeries.length > 0;
  if (agent === "structure") return new Set(value.sections.map((s) => s.id)).size === value.sections.length && value.sections.every((s) => s.sourceClaimIndexes.every((i) => i < 3));
  if (agent === "render") return !/<script\b|javascript:|<foreignObject\b/i.test(value.content) && value.plan.sectionId === value.sectionId;
  if (agent === "assembly") return value.evidenceMap.panels.every((p) => p.grounded) && value.panels.every((p) => value.evidenceMap.panels.some((e) => e.sectionId === p.sectionId));
  if (agent === "social") return value.altTexts.some((a) => a.sectionId === "s1") && value.poll.sourceClaimIndexes.every((i) => i < 3) && value.documentAd.sourceClaimIndexes.every((i) => i < 3) && value.conversationAd.sourceClaimIndexes.every((i) => i < 3) && value.newsletterSeries.issues.length === 3;
  if (agent === "regenerate") return value.sectionId === fixtures.planner.sectionId;
  return true;
}

const results = selected.map((agent) => {
  const parsed = contracts[agent].safeParse(fixtures[agent]);
  const checks = [{ name: "contract schema", pass: parsed.success, detail: parsed.success ? undefined : parsed.error.issues[0]?.message }, { name: "semantic invariants", pass: parsed.success && semantic(agent, parsed.data) }];
  return { agent, pass: checks.every((c) => c.pass), checks };
});
const report = { version: "1.0.0", mode: "offline", createdAt: new Date().toISOString(), pass: results.every((r) => r.pass), results };
await mkdir(join(process.cwd(), "tmp", "agent-harness"), { recursive: true });
await writeFile(join(process.cwd(), "tmp", "agent-harness", "latest.json"), JSON.stringify(report, null, 2));
for (const result of results) { console.log(`${result.pass ? "PASS" : "FAIL"} ${result.agent}`); for (const c of result.checks) console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`); }
console.log(`\n${report.pass ? "PASS" : "FAIL"} ${results.length} agent harness${results.length === 1 ? "" : "es"}`);
if (!report.pass) process.exitCode = 1;
