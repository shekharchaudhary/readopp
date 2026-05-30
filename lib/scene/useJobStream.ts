"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { StreamEvent } from "@/lib/events";
import { applyEvent, initialScene, type SceneState } from "./reducer";

type Action = { type: "event"; event: StreamEvent } | { type: "reset" };

function reducer(state: SceneState, action: Action): SceneState {
  if (action.type === "reset") return initialScene();
  return applyEvent(state, action.event);
}

export interface JobStreamState {
  scene: SceneState;
  connected: boolean;
  error: string | null;
}

/**
 * Subscribes to /api/jobs/:id/stream via EventSource and folds events into SceneState.
 * Reconnects on transient errors. The server replays past events on (re)connect
 * and the reducer dedupes by seq, so reconnection is lossless.
 */
export function useJobStream(jobId: string): JobStreamState {
  const [scene, dispatch] = useReducer(reducer, undefined, initialScene);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;
    dispatch({ type: "reset" });
    let cancelled = false;
    let retries = 0;

    function connect() {
      if (cancelled) return;
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      sourceRef.current = es;

      es.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setError(null);
        retries = 0;
      };

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as StreamEvent;
          dispatch({ type: "event", event });
          if (event.type === "job.completed" || event.type === "job.failed") {
            es.close();
            sourceRef.current = null;
            setConnected(false);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es.close();
        sourceRef.current = null;
        // EventSource's onerror also fires on normal stream close; only retry
        // a few times with backoff. If the job is already done, we'll get
        // job.completed/failed in the replay and stop on its own.
        retries += 1;
        if (retries > 8) {
          setError("Lost connection to the job stream.");
          return;
        }
        const delay = Math.min(1000 * 2 ** retries, 8000);
        setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      cancelled = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [jobId]);

  return { scene, connected, error };
}
