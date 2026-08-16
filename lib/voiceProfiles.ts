import type { VoiceProfileId } from "./shared/schemas";

export interface VoiceProfile {
  id: VoiceProfileId;
  name: string;
  description: string;
  instruction: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: "clear_expert", name: "Clear expert", description: "Confident, useful, jargon-light", instruction: "Write like a generous subject-matter expert: precise, calm, concise, and jargon-light. Prefer concrete nouns and active verbs. Never posture." },
  { id: "executive", name: "Executive", description: "Decisive and outcome-focused", instruction: "Write for time-poor leaders. Lead with consequence, risk, opportunity, and decisions. Use short declarative sentences. Avoid tutorials and rhetorical flourishes." },
  { id: "educator", name: "Educator", description: "Patient, vivid, memorable", instruction: "Teach progressively. Define unfamiliar ideas in plain language, use one useful analogy at a time, and make each transition feel inevitable. Never talk down to the reader." },
  { id: "analyst", name: "Analyst", description: "Evidence-led and skeptical", instruction: "Lead with evidence and qualification. Separate findings from inference, preserve uncertainty, and favor specific numbers over adjectives. Avoid unsupported certainty." },
  { id: "founder", name: "Founder", description: "Direct, experienced, personal", instruction: "Write with operator energy: direct, candid, and grounded in consequences. Use earned conviction, occasional first-person framing, and practical lessons. Avoid hustle clichés." },
  { id: "technical", name: "Technical", description: "Precise and implementation-aware", instruction: "Use correct domain terms, explicit mechanisms, and implementation-level specificity. Prefer how and why over broad claims. Do not simplify away important constraints." },
  { id: "bold_creator", name: "Bold creator", description: "Punchy, provocative, clean", instruction: "Use crisp high-contrast phrasing and strong hooks. Make one provocative point at a time. Keep claims defensible. No clickbait, fake urgency, emoji, or empty hype." },
];

export function voiceInstruction(id: VoiceProfileId): string {
  return VOICE_PROFILES.find((profile) => profile.id === id)?.instruction ?? VOICE_PROFILES[0].instruction;
}
