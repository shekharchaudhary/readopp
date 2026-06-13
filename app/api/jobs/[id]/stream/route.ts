import { getJob, listEventsSince } from "@/lib/store";
import type { StreamEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();

function formatSse(event: StreamEvent): Uint8Array {
  return ENCODER.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function formatHeartbeat(): Uint8Array {
  return ENCODER.encode(`: ping\n\n`);
}

/**
 * Polls `job_events` instead of subscribing to an in-process pub/sub.
 * Polling is fine here — the pipeline only runs 60-90 seconds, the
 * client-perceived latency budget is bounded by the agents themselves
 * (slowest step >5s), and one indexed Supabase query every 500ms is
 * cheap. Crucially, this works regardless of which Fluid Compute
 * instance the request lands on.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const job = await getJob(params.id);
  if (!job) {
    return new Response("not found", { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSeq = 0;
      let polling = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      async function tick() {
        if (closed || polling) return;
        polling = true;
        try {
          const events = await listEventsSince(params.id, lastSeq);
          for (const ev of events) {
            if (closed) break;
            safeEnqueue(formatSse(ev));
            lastSeq = ev.seq;
            if (ev.type === "job.completed" || ev.type === "job.failed") {
              closeStream();
              return;
            }
          }
        } catch {
          // Transient errors — keep polling.
        } finally {
          polling = false;
        }
      }

      // Initial replay so the client reconstructs scene state regardless
      // of when it (re)connects relative to the orchestrator's progress.
      void tick();

      const poll = setInterval(tick, 500);
      const heartbeat = setInterval(
        () => safeEnqueue(formatHeartbeat()),
        15_000
      );

      req.signal.addEventListener("abort", closeStream);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
