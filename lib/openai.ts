import OpenAI from "openai";
import { addUsage } from "./store";

export const OPENAI_MODEL_DRAW =
  process.env.OPENAI_MODEL_DRAW || "gpt-5.4";

export type OpenAIVisualContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mediaType: "image/png" };

let _client: OpenAI | null = null;

function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local before using OpenAI rendering."
    );
  }
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 4,
      timeout: 120_000,
    });
  }
  return _client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Generate visual markup with the Responses API while preserving image references. */
export async function callOpenAIVisual(
  params: {
    instructions: string;
    content: OpenAIVisualContent[];
    maxOutputTokens?: number;
  },
  ctx: { jobId?: string; label: string }
): Promise<string> {
  const client = openai();
  const content = params.content.map((block) =>
    block.type === "text"
      ? ({ type: "input_text" as const, text: block.text })
      : ({
          type: "input_image" as const,
          detail: "high" as const,
          image_url: `data:${block.mediaType};base64,${block.data}`,
        })
  );

  const response = await client.responses.create({
    model: OPENAI_MODEL_DRAW,
    instructions: params.instructions,
    input: [{ role: "user", content }],
    max_output_tokens: params.maxOutputTokens ?? 8192,
    reasoning: { effort: "low" },
    store: false,
  });

  if (ctx.jobId && response.usage) {
    void addUsage(ctx.jobId, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      calls: 1,
      cacheCreationTokens: 0,
      cacheReadTokens: response.usage.input_tokens_details.cached_tokens,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[readopp] OpenAI addUsage failed", err);
    });
  }

  const text = response.output_text.trim();
  if (!text) {
    throw new Error(`OpenAI ${ctx.label} returned no output text`);
  }
  return text;
}
