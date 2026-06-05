"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX = 50;

interface HistoryState<T> {
  past: T[];
  current: T;
  future: T[];
}

/**
 * Per-panel edit history. Push a new snapshot on every discrete edit
 * (one drag = one push, not one push per frame). Undo/redo cycle through
 * snapshots. Bounded so very long sessions don't grow unbounded.
 *
 * Snapshots are SVG strings; copying is cheap (string ref). If we ever need
 * faster pushes we can move to delta records, but snapshot is fine for now.
 */
export function useEditHistory<T>(
  initial: T,
  options: { max?: number } = {}
): {
  state: T;
  push: (next: T) => void;
  /** Replace the current snapshot without growing history (e.g. mid-drag). */
  replace: (next: T) => void;
  /** Reset the entire history to a new initial (used when the panel prop changes). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const max = options.max ?? DEFAULT_MAX;
  const [hist, setHist] = useState<HistoryState<T>>({
    past: [],
    current: initial,
    future: [],
  });

  const push = useCallback(
    (next: T) => {
      setHist((h) => {
        if (Object.is(h.current, next)) return h;
        const past = [...h.past, h.current];
        // Cap past to `max` by dropping the oldest entries.
        if (past.length > max) past.splice(0, past.length - max);
        return { past, current: next, future: [] };
      });
    },
    [max]
  );

  const replace = useCallback((next: T) => {
    setHist((h) => (Object.is(h.current, next) ? h : { ...h, current: next }));
  }, []);

  const reset = useCallback((next: T) => {
    setHist({ past: [], current: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (h.past.length === 0) return h;
      const past = h.past.slice(0, -1);
      const restored = h.past[h.past.length - 1];
      return {
        past,
        current: restored,
        future: [h.current, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHist((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past, h.current],
        current: next,
        future: rest,
      };
    });
  }, []);

  return {
    state: hist.current,
    push,
    replace,
    reset,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
  };
}

/**
 * Wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z to undo / redo while `enabled` is true.
 * Listens on the window so it works anywhere the panel has focus.
 *
 * `enabled` is typically true while a panel is being edited (mouse over,
 * focused, or selected). Disable when editing a text input so the OS's
 * built-in input undo wins.
 */
export function useUndoShortcuts(
  enabled: boolean,
  undo: () => void,
  redo: () => void
): void {
  // Use refs for the callbacks so the effect doesn't re-bind on every render.
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      // Don't intercept when the focus is on a real input/contenteditable —
      // let the OS handle text undo.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          target.isContentEditable
        )
          return;
      }
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
