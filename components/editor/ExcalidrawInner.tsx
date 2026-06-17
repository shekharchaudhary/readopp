"use client";

import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Excalidraw's TS package doesn't re-export ExcalidrawImperativeAPI from the
// public entry — keep a local opaque alias.
type ExcalidrawImperativeAPI = unknown;

/**
 * Excalidraw mount.
 *
 * Pulled out of EditorCanvas so the static `@excalidraw/excalidraw` import
 * only runs on the client. Importing the package server-side blows up
 * because its module reaches for `window`.
 *
 * Callbacks are routed through refs so the Excalidraw component sees
 * stable identities. Without this, every parent re-render was producing
 * a new `excalidrawAPI` callback, which Zustand re-subscribed to and
 * fired again — an infinite-loop "Maximum update depth exceeded".
 */

interface Props {
  initialData: unknown;
  onAPI: (api: ExcalidrawImperativeAPI) => void;
  onChange: () => void;
}

export default function ExcalidrawInner({
  initialData,
  onAPI,
  onChange,
}: Props) {
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  const onAPIRef = useRef(onAPI);
  useEffect(() => {
    onAPIRef.current = onAPI;
  }, [onAPI]);

  // Capture initialData once so a re-render can't re-initialise the scene.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableInitial = useMemo(() => initialData, []);

  const stableOnChange = useCallback(() => {
    changeRef.current();
  }, []);

  const stableExcalidrawAPI = useCallback((captured: unknown) => {
    onAPIRef.current(captured);
  }, []);

  return (
    <Excalidraw
      initialData={stableInitial as never}
      excalidrawAPI={stableExcalidrawAPI}
      onChange={stableOnChange}
    />
  );
}
