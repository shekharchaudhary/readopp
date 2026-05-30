import { getJob, listEvents, subscribe } from "@/lib/store";
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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const job = getJob(params.id);
  if (!job) {
    return new Response("not found", { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // Replay any events already persisted so a fresh subscriber reconstructs state.
      for (const ev of listEvents(params.id)) {
        safeEnqueue(formatSse(ev));
      }

      // If the job already terminated, close the stream after replay.
      const current = getJob(params.id);
      if (
        current &&
        (current.status === "completed" || current.status === "failed")
      ) {
        try {
          controller.close();
        } catch {
          // ignore
        }
        closed = true;
        return;
      }

      // Live subscription
      const unsubscribe = subscribe(params.id, (ev) => {
        safeEnqueue(formatSse(ev));
        if (ev.type === "job.completed" || ev.type === "job.failed") {
          try {
            controller.close();
          } catch {
            // ignore
          }
          closed = true;
          unsubscribe();
          clearInterval(heartbeat);
        }
      });

      // Heartbeat keeps proxies from killing the idle connection.
      const heartbeat = setInterval(() => safeEnqueue(formatHeartbeat()), 15_000);

      req.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
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
