/**
 * In-process background runner for the pipeline.
 *
 * Route handlers must not float the pipeline off with `void runJob(id)`: that
 * promise is owned by the request's async scope, and once the handler returns
 * its response Next tears the scope down. In dev that abandons the work
 * mid-flight — the job wedges in a non-terminal status forever (no completion,
 * no error), which is exactly what we saw stall at an LLM call partway through.
 *
 * Instead we drain a queue from a pump started by the instrumentation
 * `register()` hook (instrumentation.ts), which runs once at server boot
 * OUTSIDE any request. The pump — and every job it kicks off — therefore lives
 * in a process-owned async context that no request teardown can reach. Routes
 * only `enqueueJob` (a synchronous push + wake).
 *
 * The job runner is injected via `registerJobRunner` rather than imported here
 * on purpose. Instrumentation imports this module, so its import graph is
 * compiled for the instrumentation target — which can't bundle native addons
 * (resvg, chromium, …) or even `node:` builtins (`node:crypto` reaches in via
 * store.ts). So this module imports NOTHING heavy: the plain-Node route module
 * owns those imports and hands us a runner that wraps `runJob` with its own
 * crash backstop (registerRunner.ts).
 *
 * State lives on `globalThis`, NOT in module scope, because Next compiles
 * `instrumentation` and route handlers into SEPARATE webpack layers — each gets
 * its own instance of this module. A module-level queue would have the pump
 * (instrumentation layer) draining a different array than the one routes push
 * to (server layer), so jobs would sit queued forever. The global singleton is
 * the one thing both layers share.
 */
type JobRunner = (jobId: string) => Promise<void>;

interface RunnerState {
  runJobImpl: JobRunner | null;
  queue: string[];
  queued: Set<string>;
  wake: (() => void) | null;
  started: boolean;
}

const globalForRunner = globalThis as unknown as {
  __readoppRunner?: RunnerState;
};

const state: RunnerState =
  globalForRunner.__readoppRunner ??
  (globalForRunner.__readoppRunner = {
    runJobImpl: null,
    queue: [],
    queued: new Set<string>(),
    wake: null,
    started: false,
  });

export function registerJobRunner(fn: JobRunner): void {
  state.runJobImpl = fn;
}

export function enqueueJob(jobId: string): void {
  // Idempotent: ignore a duplicate trigger while the job is still waiting.
  if (state.queued.has(jobId)) return;
  state.queued.add(jobId);
  state.queue.push(jobId);
  state.wake?.();
}

async function runOne(jobId: string): Promise<void> {
  try {
    if (!state.runJobImpl) {
      throw new Error("no job runner registered");
    }
    // The injected runner owns its own crash backstop (see registerRunner.ts).
    await state.runJobImpl(jobId);
  } catch (err) {
    // Last-resort log. The injected runner already marks the job failed on
    // throw; this only fires if registration itself is missing.
    // eslint-disable-next-line no-console
    console.error(`[readopp] runJob(${jobId}) crashed`, err);
  } finally {
    state.queued.delete(jobId);
  }
}

/**
 * Long-lived pump. Started once from the instrumentation hook. Jobs are fired
 * without awaiting so they run concurrently — each inherits the pump's
 * process-owned context, not a request's.
 */
export function startRunner(): void {
  if (state.started) return;
  state.started = true;
  void (async () => {
    for (;;) {
      while (state.queue.length > 0) {
        const jobId = state.queue.shift();
        if (jobId) void runOne(jobId);
      }
      await new Promise<void>((resolve) => {
        state.wake = resolve;
      });
      state.wake = null;
    }
  })();
}
