import {
  enqueueJob,
  registerJobRunner,
  startRunner,
} from "../lib/pipeline/runner";

async function main() {
  let runs = 0;
  let releaseFirst: (() => void) | undefined;
  const firstRunStarted = new Promise<void>((resolve) => {
    registerJobRunner(async () => {
      runs += 1;
      if (runs === 1) {
        resolve();
        await new Promise<void>((release) => {
          releaseFirst = release;
        });
      }
    });
  });

  startRunner();
  enqueueJob("approval-race");
  await firstRunStarted;

  // Simulate approval arriving after brief.ready is visible but before the
  // runner's first invocation has returned.
  enqueueJob("approval-race", { requeueIfRunning: true });
  releaseFirst?.();

  const deadline = Date.now() + 2_000;
  while (runs < 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  if (runs !== 2) {
    throw new Error(`Expected one resumed run, received ${runs}.`);
  }

  let active = 0;
  let peak = 0;
  let finished = 0;
  registerJobRunner(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active -= 1;
    finished += 1;
  });
  for (let index = 0; index < 8; index += 1) enqueueJob(`bounded-${index}`);
  const drainDeadline = Date.now() + 2000;
  while (finished < 8 && Date.now() < drainDeadline) await new Promise((resolve) => setTimeout(resolve, 10));
  if (peak !== 2 || finished !== 8) throw new Error(`Bounded runner failed: peak=${peak}, finished=${finished}`);
  console.log("✓ eight queued jobs drain with at most two concurrent runners");
  console.log("✓ approval handoff requeues exactly once while the first run exits");
}

void main();
