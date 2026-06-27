import { registerJobRunner } from "./runner";
import { runJob } from "./orchestrator";
import { failJob } from "../store";

/**
 * Hands the background pump (runner.ts) its orchestrator. This module lives in
 * the plain-Node route graph — never imported by instrumentation — so the heavy
 * native deps reachable from runJob (and `node:crypto` via store.ts) stay out of
 * the edge/instrumentation bundle. Importing this file for its side effect is
 * enough; the registration runs once because module evaluation is cached.
 */
registerJobRunner(async (jobId) => {
  try {
    await runJob(jobId);
  } catch (err) {
    // Backstop for errors thrown before the orchestrator installs its own
    // try/catch (e.g. getJob / cache lookup). Without this the job would sit in
    // its last non-terminal status indefinitely.
    // eslint-disable-next-line no-console
    console.error(`[readopp] runJob(${jobId}) crashed`, err);
    const message = err instanceof Error ? err.message : String(err);
    await failJob(jobId, {
      reason: "unknown",
      message: `Pipeline crashed: ${message.slice(0, 240)}`,
    }).catch(() => {
      // DB unreachable — nothing more we can do; the client poll surfaces it.
    });
  }
});
