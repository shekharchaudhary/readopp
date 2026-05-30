/**
 * Shared agent helpers: JSON extraction from model output, and a tiny
 * call-with-validate-retry loop used by every agent that returns structured data.
 */

export function extractJson(text: string): string {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

/**
 * Run `produce(retryHint?)` up to 2 times. On the first failure, the validation
 * error is fed back in via the retryHint string so the model can self-correct.
 */
export async function withRetry<T>(
  label: string,
  produce: (retryHint: string | null) => Promise<T>
): Promise<T> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await produce(lastError);
    } catch (e) {
      lastError = (e as Error).message.slice(0, 600);
      if (attempt === 1) {
        throw new Error(`${label} failed after retry: ${lastError}`);
      }
    }
  }
  // unreachable — loop either returns or throws
  throw new Error(`${label} unreachable`);
}
