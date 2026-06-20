/**
 * Shared agent helpers: JSON extraction from model output, and a tiny
 * call-with-validate-retry loop used by every agent that returns structured data.
 */

import type { ZodIssue, ZodTypeAny, z } from "zod";

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
      lastError = (e as Error).message.slice(0, 1200);
      if (attempt === 1) {
        throw new Error(`${label} failed after retry: ${lastError}`);
      }
    }
  }
  // unreachable — loop either returns or throws
  throw new Error(`${label} unreachable`);
}

/**
 * Parse `value` against `schema`. On failure, throw an Error whose
 * message is a flat, actionable list of issues — each one says where
 * the problem is and how to fix it. Used in place of `schema.parse(v)`
 * inside the withRetry produce callback so the second attempt's prompt
 * carries concrete corrections (not Zod's raw JSON dump, which the
 * model has trouble parsing).
 *
 *   formatZodForLLM produces lines like:
 *     - "definitionCard.analogy": String must contain at most 160
 *       character(s) → Shorten to ≤160 chars.
 *     - "metaphor.items[0].name": Required → Provide a string here.
 *
 * If validation passes, returns the parsed value.
 */
export function parseWithFeedback<S extends ZodTypeAny>(
  schema: S,
  value: unknown
): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(formatZodForLLM(result.error.issues));
}

/**
 * Turn a ZodError.issues array into an instructions block the model
 * can act on. Capped at 8 issues so the prompt stays tight even when
 * the original output is broadly wrong.
 */
export function formatZodForLLM(issues: ZodIssue[]): string {
  const lines = issues.slice(0, 8).map((issue) => {
    const pathStr = issue.path
      .map((seg) => (typeof seg === "number" ? `[${seg}]` : seg))
      .reduce(
        (acc, seg) =>
          acc === "" || seg.startsWith("[") ? `${acc}${seg}` : `${acc}.${seg}`,
        ""
      ) || "(root)";
    const fix = humanFixHint(issue);
    return `  - "${pathStr}": ${issue.message}${fix ? ` → ${fix}` : ""}`;
  });
  const more =
    issues.length > 8 ? `\n  (…${issues.length - 8} more issues)` : "";
  return `Validation failed. Fix EACH of these in your next attempt:\n${lines.join("\n")}${more}`;
}

function humanFixHint(issue: ZodIssue): string | null {
  switch (issue.code) {
    case "too_big": {
      const limit = (issue as { maximum?: number | bigint }).maximum;
      if (issue.type === "string")
        return `Shorten this string to ≤${limit} chars.`;
      if (issue.type === "array")
        return `Use at most ${limit} items in this array.`;
      if (issue.type === "number")
        return `Use a value ≤${limit}.`;
      return null;
    }
    case "too_small": {
      const limit = (issue as { minimum?: number | bigint }).minimum;
      if (issue.type === "string")
        return `Provide at least ${limit} char${limit === 1 ? "" : "s"} (cannot be empty).`;
      if (issue.type === "array")
        return `Provide at least ${limit} item${limit === 1 ? "" : "s"} in this array.`;
      if (issue.type === "number")
        return `Use a value ≥${limit}.`;
      return null;
    }
    case "invalid_type": {
      const got = (issue as { received?: string }).received;
      const want = (issue as { expected?: string }).expected;
      if (got === "undefined")
        return `Required field — provide a ${want}.`;
      return `Wrong type — expected ${want}, got ${got}.`;
    }
    case "invalid_enum_value": {
      const options = (issue as { options?: readonly string[] }).options;
      if (options) return `Use one of: ${options.join(" | ")}.`;
      return null;
    }
    case "invalid_string": {
      const validation = (issue as { validation?: string }).validation;
      return validation ? `String must match format: ${validation}.` : null;
    }
    case "unrecognized_keys": {
      const keys = (issue as { keys?: string[] }).keys;
      if (keys) return `Remove unrecognized keys: ${keys.join(", ")}.`;
      return null;
    }
    case "custom": {
      // Schema-defined refine messages already carry their own fix hint
      // in issue.message; nothing to add.
      return null;
    }
    default:
      return null;
  }
}
