import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsNonStreaming,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { addUsage } from "./store";

/**
 * Build a cached system-prompt block. The Anthropic API supports prompt
 * caching by attaching `cache_control: { type: "ephemeral" }` to any text
 * block — subsequent calls with an identical prefix pay 10% of normal input
 * cost on a cache hit, 125% on the initial write. SDK 0.32 predates this
 * field in its TypeScript types, so we cast at the boundary. The wire format
 * accepts it on all current Claude models above the cache-size threshold
 * (1024 tokens for Sonnet/Opus, 2048 for Haiku).
 */
export function cachedSystem(text: string): TextBlockParam[] {
  return [
    { type: "text", text, cache_control: { type: "ephemeral" } } as TextBlockParam,
  ];
}

// Strong tier: comprehension / planning / render quality.
// Fast tier: mechanical cleanups / classification.
// Draw tier: freeform SVG/HTML panel drawing — the one stage where raw
// drawing ability visibly moves output quality, so it gets the top model.
// Override any tier via env if you want to swap models without code changes.
export const MODEL_STRONG =
  process.env.ANTHROPIC_MODEL_STRONG || "claude-sonnet-4-5";
export const MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5-20251001";
export const MODEL_DRAW =
  process.env.ANTHROPIC_MODEL_DRAW || "claude-opus-4-7";

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

// ---------- Retry-aware request helper ----------

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 20_000;

interface RetryableError {
  status?: number;
  message?: string;
  headers?: Record<string, string | undefined>;
}

function isRetryable(err: unknown): boolean {
  const e = err as RetryableError;
  const status = e.status;
  if (typeof status === "number") {
    // 408 timeout, 425 too early, 429 rate-limit, 5xx overload
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500 && status < 600) return true;
  }
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("overloaded") ||
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

function backoffMs(attempt: number, retryAfter?: string): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_DELAY_MS);
    }
  }
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = Math.random() * 0.4 + 0.8; // 0.8x - 1.2x
  return Math.round(exp * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface CallContext {
  /** Job ID to attribute token usage to. Optional. */
  jobId?: string;
  /** Short label used in retry logs. */
  label: string;
}

/**
 * Wraps an Anthropic messages.create call with:
 *  - automatic retry on 429 / 5xx / overload / transient network errors,
 *    using exponential backoff with jitter, honoring Retry-After when present.
 *  - token usage accumulation onto the calling job (if jobId provided).
 *
 * All agents should call through this helper, never client.messages.create directly.
 */
export async function callMessages(
  params: MessageCreateParamsNonStreaming,
  ctx: CallContext
) {
  const client = anthropic();
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await client.messages.create(params);
      // Record usage. Fire-and-forget — usage is a side log and a transient
      // DB hiccup shouldn't break the model call. Errors are logged below.
      if (ctx.jobId && res.usage) {
        const u = res.usage as {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
        void addUsage(ctx.jobId, {
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          calls: 1,
          cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[readopp] addUsage failed", err);
        });
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) throw err;
      const e = err as RetryableError;
      const wait = backoffMs(attempt, e.headers?.["retry-after"]);
      // eslint-disable-next-line no-console
      console.warn(
        `[readopp] ${ctx.label} transient error (status=${e.status ?? "?"}), retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`
      );
      await sleep(wait);
    }
  }

  throw lastErr;
}
