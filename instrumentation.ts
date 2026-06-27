/**
 * Runs once at server boot, before any request. We use it to start the
 * background job pump in a process-owned async context — see
 * lib/pipeline/runner.ts for why that context isolation matters.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startRunner } = await import("./lib/pipeline/runner");
  startRunner();
}
