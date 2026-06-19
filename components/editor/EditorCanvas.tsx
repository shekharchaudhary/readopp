"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { svgToExcalidrawElements } from "@/lib/editor/svgToExcalidraw";

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

// Excalidraw + library hook + CSS all live in ExcalidrawInner so the
// `@excalidraw/excalidraw` module never evaluates server-side.
const ExcalidrawInner = dynamic(() => import("./ExcalidrawInner"), {
  ssr: false,
  loading: () => <CanvasLoading />,
});

type LibraryItemLike = { id: string; [k: string]: unknown };
type LibraryItemsSource =
  | LibraryItemLike[]
  | ((current: LibraryItemLike[]) => Promise<LibraryItemLike[]> | LibraryItemLike[]);

type ExcalidrawAPI = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => unknown;
  getFiles: () => Record<string, unknown>;
  // The library now ships only native primitives (lines, rects, ellipses,
  // arrows, text) so no addFiles() call is needed — every element renders
  // without a file map. We pass a function form to merge while replacing
  // our prior `readopp-*` items, so library updates always propagate.
  updateLibrary: (opts: {
    libraryItems: LibraryItemsSource;
    openLibraryMenu?: boolean;
    merge?: boolean;
    defaultStatus?: "published" | "unpublished";
  }) => Promise<unknown>;
};

const READOPP_ITEM_PREFIX = "readopp-";

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
  /**
   * Called by the explicit Save button and by Done with the canvas exported
   * to an SVG string. The parent uses this to write the edited SVG into the
   * static panel content so the explainer view reflects the edits, not just
   * the in-editor canvas. Auto-save does NOT call this — it only persists
   * the Excalidraw scene to panel_scenes for crash-recovery / resume.
   */
  onCommit?: (svgString: string) => Promise<void>;
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
  onCommit,
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
  // Library import runs silently on every mount — the merge-replace path
  // inside handleLoadLibrary strips prior `readopp-*` items and prepends
  // the fresh set, so updates to lib/editor/library.ts always propagate
  // without the user clearing localStorage. libraryLoaded is kept only
  // to avoid retriggering while a load is in-flight.
  const [libraryLoading, setLibraryLoading] = useState(false);
  const libraryStarted = useRef(false);

  // Build the initial scene exactly once. Resolution order:
  //   1. If the parent SSR-passed a scene object, use it.
  //   2. If the parent SSR-passed null, build the seed from the panel SVG.
  //   3. If undefined, hit the server first (for inline-mode opens after a
  //      prior auto-save), then fall back to the seed when nothing's saved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apply = (scene: unknown) => {
        if (cancelled) return;
        setInitialData(scene);
      };
      if (initialScene && typeof initialScene === "object") {
        apply(initialScene);
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
      // Auto-reseed when the saved scene has nothing worth preserving —
      // empty elements (auto-save fired without real edits) or the
      // pre-converter single-locked-image legacy state. Real edits load
      // untouched. See shouldReseed() for the exact patterns.
      if (
        resolved &&
        typeof resolved === "object" &&
        !shouldReseed(resolved)
      ) {
        // eslint-disable-next-line no-console
        console.info(
          "[readopp] canvas: loaded saved scene with",
          (resolved as { elements?: unknown[] }).elements?.length ?? 0,
          "elements"
        );
        apply(resolved);
        return;
      }
      const seed = await buildSeedScene(panelContent, panelFormat, heading);
      // eslint-disable-next-line no-console
      console.info(
        "[readopp] canvas: re-seeded from panel SVG with",
        (seed as { elements?: unknown[] }).elements?.length ?? 0,
        "elements"
      );
      apply(seed);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    initialScene,
    panelContent,
    panelFormat,
    heading,
    explainerId,
    sectionId,
  ]);

  /**
   * Import of the curated Readopp library. Fetches the .excalidrawlib JSON
   * from /api/library/readopp and pipes it into the Excalidraw instance
   * through updateLibrary — Excalidraw's own supported import path.
   *
   * Runs on every editor mount (silently, no menu pop). The function form
   * of `libraryItems` lets us read the user's current library, strip any
   * prior `readopp-*` items, and prepend the freshly-fetched set. User-
   * added items (anything not prefixed with `readopp-`) survive untouched.
   * merge: false → our returned set IS the new library, so updates to
   * lib/editor/library.ts propagate on the next mount automatically —
   * no localStorage clearing required.
   */
  const handleLoadLibrary = useCallback(async () => {
    if (!apiRef.current || libraryLoading) return;
    setLibraryLoading(true);
    try {
      const r = await fetch("/api/library/readopp", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const lib = (await r.json()) as { libraryItems: LibraryItemLike[] };
      // Diagnostic: see how many of our items survive Excalidraw's own
      // restoreLibraryItems validation. Silent drops show up here.
      try {
        const mod = await import("@excalidraw/excalidraw");
        const restored = mod.restoreLibraryItems(
          lib.libraryItems as never,
          "unpublished"
        );
        console.info(
          `[readopp] library: sent ${lib.libraryItems.length}, restored ${restored.length}`
        );
      } catch {
        // diagnostic only — don't block the import
      }
      await apiRef.current.updateLibrary({
        libraryItems: (current: LibraryItemLike[]) => {
          const userOnly = (current ?? []).filter(
            (it) => typeof it?.id === "string" && !it.id.startsWith(READOPP_ITEM_PREFIX)
          );
          return [...lib.libraryItems, ...userOnly];
        },
        merge: false,
        defaultStatus: "unpublished",
      });
    } catch {
      // No user-facing toast for library failures yet; they show in console.
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryLoading]);

  /**
   * Excalidraw's API callback. Captures the imperative handle into our
   * ref AND triggers a library refresh on every mount. The libraryStarted
   * ref gates against React's strict-mode double-mount re-firing the
   * import twice in dev.
   */
  const handleAPI = useCallback(
    (api: unknown) => {
      apiRef.current = api as ExcalidrawAPI;
      if (!libraryStarted.current) {
        libraryStarted.current = true;
        void handleLoadLibrary();
      }
    },
    [handleLoadLibrary]
  );

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

  /**
   * Export the current canvas to an SVG string. Excalidraw natively emits
   * an <svg> element; we serialize it for transport. Falls back to null if
   * the api isn't ready or the export throws.
   */
  const exportSceneAsSvg = useCallback(async (): Promise<string | null> => {
    if (!apiRef.current) return null;
    const api = apiRef.current;
    try {
      const mod = await import("@excalidraw/excalidraw");
      const svgEl = await mod.exportToSvg({
        elements: api.getSceneElements() as never,
        appState: {
          ...(api.getAppState() as object),
          exportBackground: true,
          viewBackgroundColor: "#FAF9F5",
          exportPadding: 32,
        } as never,
        files: api.getFiles() as never,
      });
      return new XMLSerializer().serializeToString(svgEl);
    } catch {
      return null;
    }
  }, []);

  /**
   * Save scene to panel_scenes AND commit the rendered SVG back to the
   * panel content via onCommit. Used by the explicit Save button and by
   * Done. Reports a single combined save state so the pill stays accurate.
   */
  const handleSave = useCallback(async () => {
    // Scene save (for resume) and commit (for visible edits) are independent
    // operations. Even if the scene save fails (e.g. panel_scenes migration
    // not applied yet), still try to commit the SVG so the user sees their
    // edits in the static panel view. The user can always re-edit later.
    const sceneOk = await flushSave();
    if (!onCommit) return sceneOk;
    const svg = await exportSceneAsSvg();
    if (!svg) {
      if (!sceneOk) return false;
      setSaving({ kind: "error", message: "Could not export canvas" });
      return false;
    }
    try {
      await onCommit(svg);
      setSaving({ kind: "saved", at: Date.now() });
      return true;
    } catch (e) {
      setSaving({
        kind: "error",
        message: (e as Error).message?.slice(0, 80) || "commit failed",
      });
      return false;
    }
  }, [flushSave, exportSceneAsSvg, onCommit]);

  const handleDone = useCallback(async () => {
    // Best-effort: save + commit before closing. Even if either fails, still
    // close so the user isn't trapped — the Save-failed pill stays visible.
    await handleSave();
    onDone?.();
  }, [handleSave, onDone]);

  /**
   * Escape hatch when the canvas opens blank or stuck. Wipes the saved
   * scene server-side, rebuilds the seed from the current panel SVG,
   * and swaps it in as the new initial data. Excalidraw remounts via
   * the `key` we change downstream so the new scene takes effect.
   */
  const [seedKey, setSeedKey] = useState(0);
  const handleRestoreFromPanel = useCallback(async () => {
    if (
      !window.confirm(
        "Restore this canvas to the original panel content? Your unsaved canvas edits will be lost."
      )
    ) {
      return;
    }
    // Cancel any pending auto-save so we don't immediately re-persist
    // whatever Excalidraw had on screen.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await fetch(`/api/scenes/${explainerId}/${sectionId}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch {
      // Even if the server delete fails, fall through and reseed locally.
    }
    const seed = await buildSeedScene(panelContent, panelFormat, heading);
    // eslint-disable-next-line no-console
    console.info(
      "[readopp] canvas: restored from panel, seeded",
      (seed as { elements?: unknown[] }).elements?.length ?? 0,
      "elements"
    );
    // Reset the dirty/settled tracking so the reseeded scene doesn't
    // immediately count as an edit.
    settled.current = false;
    setSaving({ kind: "idle" });
    setInitialData(seed);
    setSeedKey((k) => k + 1);
  }, [explainerId, sectionId, panelContent, panelFormat, heading]);

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
          onClick={() => void handleRestoreFromPanel()}
          title="Discard canvas edits and restore the original panel"
          className="rounded-full border border-paper-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink"
        >
          Restore from panel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
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
          <ExcalidrawInner
            // Bump on Restore so Excalidraw fully unmounts + remounts
            // with the fresh seed — initialData is only read at mount.
            key={seedKey}
            initialData={initialData}
            onAPI={handleAPI}
            onChange={scheduleSave}
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

// ---------- Seeding ----------

/**
 * Build the initial scene for a panel that hasn't been edited before.
 *
 * For SVG panels we first try to parse the SVG into native Excalidraw
 * elements (text, rect, line, ellipse, polyline) — that's what makes
 * individual headings, captions, shapes, and squiggles editable. If the
 * parser fails (malformed SVG, unsupported features) we fall back to
 * the legacy path: embed the whole SVG as a locked image so the user
 * at least sees their panel.
 */
async function buildSeedScene(
  panelContent: string,
  panelFormat: "svg" | "html",
  heading: string
): Promise<unknown> {
  // HTML panels can't be embedded as a single image. Open a blank canvas
  // with a title placeholder — HTML rasterization is a future-session
  // feature.
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

  // Preferred path: parse the SVG into editable Excalidraw elements.
  // svgToExcalidrawElements runs in the browser only — server-side
  // calls return null, in which case the page-side useEffect re-resolves
  // the scene after mount.
  const SEED_OFFSET_X = 120;
  const SEED_OFFSET_Y = 80;
  const SEED_GROUP_ID = "readopp-seed-panel";
  const converted = svgToExcalidrawElements(panelContent, {
    offsetX: SEED_OFFSET_X,
    offsetY: SEED_OFFSET_Y,
    groupId: SEED_GROUP_ID,
  });
  if (converted && converted.elements.length > 0) {
    return {
      type: "excalidraw",
      version: 2,
      source: "readopp",
      elements: converted.elements,
      appState: { viewBackgroundColor: "#FAF9F5" },
      files: {},
    };
  }

  // Fallback path: embed the SVG as a locked image element so the user
  // still sees their panel even when parsing fails.
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
        x: SEED_OFFSET_X,
        y: SEED_OFFSET_Y,
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

/**
 * True when a saved scene contains nothing worth preserving — meaning
 * we should discard it and re-seed from the panel SVG so the canvas
 * doesn't open blank or stuck on a locked image.
 *
 * Three patterns count as "no edits":
 *  - Empty elements array (auto-save fired without real edits or
 *    persisted state was somehow zeroed).
 *  - Exactly one locked seed image (the pre-converter legacy state).
 *  - Exactly one non-deleted element AND every non-deleted element has
 *    isDeleted=true... actually rare; covered by the empty case after
 *    Excalidraw's restore pass.
 *
 * Any scene with real edits (multiple elements, moved seed, unlocked,
 * or user-added shapes) bypasses the reseed and loads untouched.
 */
function shouldReseed(scene: unknown): boolean {
  if (!scene || typeof scene !== "object") return false;
  const els = (scene as { elements?: unknown[] }).elements;
  if (!Array.isArray(els)) return false;
  const live = els.filter(
    (e) => !(e as { isDeleted?: boolean })?.isDeleted
  );
  if (live.length === 0) return true;
  if (live.length === 1) {
    const el = live[0] as {
      type?: string;
      id?: string;
      locked?: boolean;
    };
    if (
      el?.type === "image" &&
      typeof el.id === "string" &&
      el.id.startsWith("seed-") &&
      el.locked === true
    ) {
      return true;
    }
  }
  return false;
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
