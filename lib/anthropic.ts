import Anthropic from "@anthropic-ai/sdk";

// Strong tier: comprehension / planning / render quality.
// Fast tier: mechanical cleanups / classification (unused in Phase 1; reserved).
// Override either via env if you want to swap models without code changes.
export const MODEL_STRONG =
  process.env.ANTHROPIC_MODEL_STRONG || "claude-sonnet-4-5";
export const MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before running the pipeline."
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function isApiKeyConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
