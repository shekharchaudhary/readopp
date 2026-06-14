"use client";

import "@excalidraw/excalidraw/index.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Full-canvas panel editor — Excalidraw mounted on /edit/[id]/[section]/.
 *
 * The user's generated panel is seeded as a locked image element so they
 * can compose icons, shapes, arrows, text on top of it. Scenes are auto-
 * saved (debounced 1.5 s) to /api/scenes/[id]/[section]. Export emits a
 * 1080×1080 PNG ready for LinkedIn.
 *
 * Excalidraw can't render server-side (it needs window) so we dynamic-import
 * with ssr:false. That also keeps its ~1 MB bundle off every other route.
 */

// Excalidraw's main component — client only.
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <CanvasLoading /> }
);

type ExcalidrawAPI = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => unknown;
  getFiles: () => Record<string, unknown>;
};

interface Props {
  explainerId: string;
  sectionId: string;
  heading: string;
  panelContent: string;
  panelFormat: "svg" | "html";
  /**
   * Initial Excalidraw scene. Three states:
   *   • object → use it directly (SSR-loaded from the server)
   *   • null   → no saved scene exists; build a seed from the panel SVG
   *   • undefined → fetch from /api/scenes on mount, then null-or-seed
   *
   * The /edit page passes object|null because it already SSR-loads. The
   * inline panel-card editor passes undefined so the GET happens on first
   * open and reflects any prior auto-saved work.
   */
  initialScene: unknown;
  /**
   * Height the canvas should occupy. Defaults to a viewport-filling value
   * for the full-page editor; the inline panel mode passes a fixed pixel
   * value so the canvas fits inside the panel card.
   */
  height?: string;
  /**
   * Called when the user clicks "Done" — only rendered when provided, used
   * by the inline panel-card editor to switch back to the static view.
   */
  onDone?: () => void;
}

const SEED_FILE_ID = "readopp-panel-base";

export function EditorCanvas({
  explainerId,
  sectionId,
  heading,
  panelContent,
  panelFormat,
  initialScene,
  height,
  onDone,
}: Props) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  type SaveState =
    | { kind: "idle" }
    | { kind: "dirty" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string };
  const [saving, setSaving] = useState<SaveState>({ kind: "idle" });
  const [exporting, setExporting] = useState(false);
  const [initialData, setInitialData] = useState<unknown | null>(null);
  // Skip the first onChange Excalidraw fires after hydration so we don't
  // mark the panel dirty before the user has touched anything.
  const settled = useRef(false);

  // Build the initial scene exactly once. Resolution order:
  //   1. If the parent SSR-passed a scene object, use it.
  //   2. If the parent SSR-passed null, build the seed from the panel SVG.
  //   3. If undefined, hit the server first (for inline-mode opens after a
  //      prior auto-save), then fall back to the seed when nothing's saved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialScene && typeof initialScene === "object") {
        if (!cancelled) setInitialData(initialScene);
        return;
      }
      let resolved: unknown = initialScene;
      if (resolved === undefined) {
        try {
          const r = await fetch(`/api/scenes/${explainerId}/${sectionId}`, {
            cache: "no-store",
          });
          if (r.ok) {
            const body = (await r.json()) as { scene: unknown };
            resolved = body.scene;
          }
        } catch {
          // fall through to seed
        }
      }
      if (resolved && typeof resolved === "object") {
        if (!cancelled) setInitialData(resolved);
        return;
      }
      const seed = await buildSeedScene(panelContent, panelFormat, heading);
      if (!cancelled) setInitialData(seed);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialScene, panelContent, panelFormat, heading, explainerId, sectionId]);

  /**
   * Fire a save POST now, return whether it succeeded. Used by both the
   * explicit Save button and Done (which saves before closing).
   */
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!apiRef.current) return false;
    const api = apiRef.current;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving({ kind: "saving" });
    try {
      const scene = {
        type: "excalidraw",
        version: 2,
        source: "readopp",
        elements: api.getSceneElements(),
        appState: stripVolatileAppState(api.getAppState()),
        files: api.getFiles(),
      };
      const res = await fetch(`/api/scenes/${explainerId}/${sectionId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) detail = body.error;
        } catch {
          // body wasn't JSON — keep the status code
        }
        setSaving({ kind: "error", message: detail });
        return false;
      }
      setSaving({ kind: "saved", at: Date.now() });
      return true;
    } catch (e) {
      setSaving({
        kind: "error",
        message: (e as Error).message?.slice(0, 80) || "network error",
      });
      return false;
    }
  }, [explainerId, sectionId]);

  /**
   * Debounced background save — fires 1.5s after the last edit. The explicit
   * Save button bypasses the debounce. The first onChange after hydration is
   * ignored so opening the editor doesn't mark the panel dirty.
   */
  const scheduleSave = useCallback(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving({ kind: "dirty" });
    saveTimer.current = setTimeout(() => {
      void flushSave();
    }, 1500);
  }, [flushSave]);

  const handleDone = useCallback(async () => {
    // Best-effort save before closing. Even if save fails, still close so
    // the user isn't trapped — the Save-failed pill stays visible up top.
    await flushSave();
    onDone?.();
  }, [flushSave, onDone]);

  const handleExport = useCallback(async () => {
    if (!apiRef.current) return;
    setExporting(true);
    try {
      const exportMod = await import("@excalidraw/excalidraw");
      const blob = await exportMod.exportToBlob({
        elements: apiRef.current.getSceneElements() as never,
        appState: {
          ...(apiRef.current.getAppState() as object),
          exportBackground: true,
          viewBackgroundColor: "#FAF9F5",
          exportPadding: 48,
        } as never,
        files: apiRef.current.getFiles() as never,
        mimeType: "image/png",
        // Scale up so the exported image lands close to 1080×1080 even when
        // the source SVG is 680 wide. Excalidraw's exportToBlob honours
        // getDimensions if provided; otherwise it uses element bounds × scale.
        getDimensions: (w: number, h: number) => {
          const scale = 1080 / Math.max(w, h);
          return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
        },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(heading || "panel")}-${sectionId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [heading, sectionId]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sticky action strip above the canvas so it can't collide with
          Excalidraw's own top toolbar. */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-paper-line bg-surface px-4 py-2">
        <span
          className={
            "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider " +
            (saving.kind === "error"
              ? "bg-rose/15 text-rose-deep"
              : "bg-paper text-ink-muted")
          }
          title={saving.kind === "error" ? saving.message : undefined}
        >
          {saving.kind === "idle" && "Auto-save on"}
          {saving.kind === "dirty" && "Edited — saves in 1.5s"}
          {saving.kind === "saving" && "Saving…"}
          {saving.kind === "saved" && "Saved"}
          {saving.kind === "error" && `Save failed · ${saving.message.slice(0, 60)}`}
        </span>
        <button
          type="button"
          onClick={() => void flushSave()}
          disabled={saving.kind === "saving"}
          className="rounded-full border border-paper-line bg-paper px-4 py-1.5 text-sm font-medium text-ink transition hover:border-ink-muted disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={() => void handleDone()}
            className="rounded-full border border-paper-line bg-paper px-4 py-1.5 text-sm font-medium text-ink transition hover:border-ink-muted"
          >
            Done
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1" style={height ? { height } : undefined}>
        {initialData ? (
          <ExcalidrawMount
            initialData={initialData}
            apiRef={apiRef}
            scheduleSave={scheduleSave}
          />
        ) : (
          <CanvasLoading />
        )}
      </div>
    </div>
  );
}

function CanvasLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper text-sm text-ink-muted">
      Loading canvas…
    </div>
  );
}

/**
 * Isolates the Excalidraw mount so its props are stable across the parent's
 * re-renders. Without this, every parent re-render (every Save status flip)
 * would hand Excalidraw a fresh `onChange` identity, its internal Zustand
 * store would resubscribe, and the resubscribe would re-fire onChange →
 * infinite loop. We capture the latest scheduleSave in a ref and expose a
 * single stable `onChange` callback that reads through to the current ref.
 * `initialData` is captured once via useMemo so a re-render can't trigger
 * Excalidraw to re-initialise.
 */
function ExcalidrawMount({
  initialData,
  apiRef,
  scheduleSave,
}: {
  initialData: unknown;
  apiRef: React.MutableRefObject<ExcalidrawAPI | null>;
  scheduleSave: () => void;
}) {
  const scheduleRef = useRef(scheduleSave);
  useEffect(() => {
    scheduleRef.current = scheduleSave;
  }, [scheduleSave]);

  // Capture initialData once. Re-mounting on initialData identity change
  // would also re-trigger the seed-or-fetch effect in the parent.
  const stableInitial = useMemo(() => initialData, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const stableOnChange = useCallback(() => {
    scheduleRef.current();
  }, []);

  const stableExcalidrawAPI = useCallback(
    (api: unknown) => {
      apiRef.current = api as ExcalidrawAPI;
    },
    [apiRef]
  );

  return (
    <Excalidraw
      initialData={stableInitial as never}
      excalidrawAPI={stableExcalidrawAPI}
      onChange={stableOnChange}
    />
  );
}

// ---------- Seeding ----------

/**
 * Build the initial scene for a panel that hasn't been edited before. The
 * generated SVG is embedded as a locked image element so the user starts
 * with their panel on the canvas and decorates around / over it.
 */
async function buildSeedScene(
  panelContent: string,
  panelFormat: "svg" | "html",
  heading: string
): Promise<unknown> {
  // HTML panels (the comparison/timeline ones) can't be embedded as a single
  // image. Open a blank canvas with a title placeholder instead — full HTML
  // → PNG rasterization is a future-session feature.
  if (panelFormat !== "svg") {
    return {
      type: "excalidraw",
      version: 2,
      source: "readopp",
      elements: [
        textElement({
          id: "seed-title",
          x: 120,
          y: 120,
          text: heading || "Untitled panel",
          fontSize: 28,
        }),
      ],
      appState: { viewBackgroundColor: "#FAF9F5" },
      files: {},
    };
  }

  const { width, height } = extractSvgDims(panelContent, 680, 480);
  const dataUrl =
    "data:image/svg+xml;base64," +
    (typeof window === "undefined"
      ? Buffer.from(panelContent).toString("base64")
      : window.btoa(unescape(encodeURIComponent(panelContent))));

  const fileId = SEED_FILE_ID;
  return {
    type: "excalidraw",
    version: 2,
    source: "readopp",
    elements: [
      imageElement({
        id: "seed-base",
        fileId,
        x: 120,
        y: 80,
        width,
        height,
      }),
    ],
    appState: { viewBackgroundColor: "#FAF9F5" },
    files: {
      [fileId]: {
        id: fileId,
        mimeType: "image/svg+xml",
        dataURL: dataUrl,
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    },
  };
}

function extractSvgDims(svg: string, fallbackW: number, fallbackH: number) {
  const m = svg.match(/viewBox\s*=\s*"\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*"/i);
  if (!m) return { width: fallbackW, height: fallbackH };
  const w = Number(m[3]);
  const h = Number(m[4]);
  return {
    width: Number.isFinite(w) && w > 0 ? w : fallbackW,
    height: Number.isFinite(h) && h > 0 ? h : fallbackH,
  };
}

// Excalidraw doesn't export element-builder helpers in the public typings,
// so we hand-roll the minimum shape. Versions before/after both accept any
// extra fields they don't recognise.
function imageElement(args: {
  id: string;
  fileId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    id: args.id,
    type: "image",
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: true,
    fileId: args.fileId,
    status: "saved",
    scale: [1, 1],
  } as const;
}

function textElement(args: {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}) {
  return {
    id: args.id,
    type: "text",
    x: args.x,
    y: args.y,
    width: 600,
    height: args.fontSize * 1.5,
    angle: 0,
    strokeColor: "#1a1a1a",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 2,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text: args.text,
    fontSize: args.fontSize,
    fontFamily: 5,
    textAlign: "left" as const,
    verticalAlign: "top" as const,
    baseline: args.fontSize,
    containerId: null,
    originalText: args.text,
    autoResize: true,
    lineHeight: 1.25,
  } as const;
}

// Trim fields that don't belong in persisted scenes (collaborators, theme,
// cursor positions, etc.). Excalidraw's exportToClipboard ignores them too.
function stripVolatileAppState(appState: unknown): unknown {
  if (!appState || typeof appState !== "object") return {};
  const safe: Record<string, unknown> = {};
  const src = appState as Record<string, unknown>;
  const keep = [
    "viewBackgroundColor",
    "gridSize",
    "scrollX",
    "scrollY",
    "zoom",
    "currentItemStrokeColor",
    "currentItemBackgroundColor",
    "currentItemFillStyle",
    "currentItemStrokeWidth",
    "currentItemRoughness",
    "currentItemOpacity",
    "currentItemFontFamily",
    "currentItemFontSize",
    "currentItemTextAlign",
  ];
  for (const k of keep) if (k in src) safe[k] = src[k];
  return safe;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
