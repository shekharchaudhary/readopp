"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { svgToExcalidrawElements } from "@/lib/editor/svgToExcalidraw";
import { markCanvasOverride } from "@/lib/templates/canvasOverride";

/**
 * Full-canvas panel editor — Excalidraw mounted on /edit/[id]/[section]/.
 *
 * The user's selected layout is seeded as native text, shapes, lines, paths,
 * and diagram elements so every part can be changed in one place. Scenes are
 * auto-saved (debounced 1.5 s) to /api/scenes/[id]/[section]. Export emits a
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
  addFiles: (files: readonly unknown[]) => void;
  updateScene: (scene: { elements?: readonly unknown[]; appState?: unknown }) => void;
  setActiveTool: (tool: { type: string }) => void;
  scrollToContent: (
    target?: string | unknown | readonly unknown[],
    options?: {
      fitToViewport?: boolean;
      viewportZoomFactor?: number;
      animate?: boolean;
      duration?: number;
    }
  ) => void;
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
  /** Native editable scene for the selected suggested layout. */
  seedSceneUrl?: string;
  /** Changes whenever template, layout, theme, or panel copy changes. */
  seedVersion?: string;
  /**
   * Initial Excalidraw scene. Three states:
   *   • object → use it directly (SSR-loaded from the server)
   *   • null   → no saved scene exists; build the selected editable seed
   *   • undefined → fetch from /api/scenes on mount, then null-or-seed
   *
   * The /edit page passes object|null because it already SSR-loads.
   */
  initialScene: unknown;
  /**
   * Called by the explicit Save button and by Done with the canvas exported
   * to an SVG string. The parent uses this to write the edited SVG into the
   * static panel content so the explainer view reflects the edits, not just
   * the in-editor canvas. Auto-save does NOT call this — it only persists
   * the Excalidraw scene to panel_scenes for crash-recovery / resume.
   */
  onCommit?: (svgString: string) => Promise<void>;
  /** Navigate here after Done successfully saves the scene and panel. */
  returnHref?: string;
  /** Adjacent panel routes. Navigation saves and commits this panel first. */
  previousPanelHref?: string;
  nextPanelHref?: string;
  previousPanelLabel?: string;
  nextPanelLabel?: string;
  /** Preserve canvas output as the source of truth for visual templates. */
  commitAsCanvasOverride?: boolean;
  /** Open the native title composer for a newly inserted blank panel. */
  promptForTitle?: boolean;
}

const SEED_FILE_ID = "readopp-panel-base";

export function EditorCanvas({
  explainerId,
  sectionId,
  heading,
  panelContent,
  panelFormat,
  seedSceneUrl,
  seedVersion,
  initialScene,
  onCommit,
  returnHref,
  previousPanelHref,
  nextPanelHref,
  previousPanelLabel,
  nextPanelLabel,
  commitAsCanvasOverride = false,
  promptForTitle = false,
}: Props) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  type SaveState =
    | { kind: "idle" }
    | { kind: "dirty" }
    | { kind: "saving" }
    | { kind: "saved"; at: number; scope: "draft" | "panel" }
    | { kind: "error"; message: string };
  const [saving, setSaving] = useState<SaveState>({ kind: "idle" });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [textComposerOpen, setTextComposerOpen] = useState(false);
  const [textComposerTargetId, setTextComposerTargetId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [resetAction, setResetAction] = useState<"restore" | "blank" | null>(null);
  const [selectedText, setSelectedText] = useState<{ id: string; text: string } | null>(null);
  const selectedTextRef = useRef<{ id: string; text: string } | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const restoreToolsFocusRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  const resetTriggerRef = useRef<HTMLElement | null>(null);
  const [initialData, setInitialData] = useState<unknown | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState(false);
  const [seedKey, setSeedKey] = useState(0);
  const [canvasFitted, setCanvasFitted] = useState(false);
  const viewportFitKey = useRef<number | null>(null);
  // Excalidraw can normalize text measurements and element versions during
  // hydration. Capture the settled scene once the fitting veil is removed so
  // those internal changes never masquerade as a user edit.
  const hydrationBaselineKey = useRef<number | null>(null);
  // Excalidraw fires onChange for viewport/tool changes too. Keep a compact
  // element signature so only real canvas mutations schedule persistence.
  const lastSceneSignature = useRef<string | null>(null);
  // Opening the canvas is a read-only action until the user actually changes
  // an element. This prevents Done or panel navigation from
  // silently turning an untouched generated panel into a canvas override.
  const sceneChangedSinceOpen = useRef(false);
  // The visible panel title is a normal Excalidraw text element. Remember its
  // id so rewriting it in the canvas can also update the story-card label.
  const headingElementIdRef = useRef<string | null>(null);
  const titlePromptOpenedRef = useRef(false);
  // App-controlled exits already save (or intentionally skip an unchanged
  // scene), so they must not be stopped by the generic browser-leave guard.
  const allowNavigation = useRef(false);
  // Library import runs silently on every mount — the merge-replace path
  // inside handleLoadLibrary strips prior `readopp-*` items and prepends
  // the fresh set, so updates to lib/editor/library.ts always propagate
  // without the user clearing localStorage. libraryLoaded is kept only
  // to avoid retriggering while a load is in-flight.
  const [libraryLoading, setLibraryLoading] = useState(false);
  const libraryStarted = useRef(false);

  useEffect(() => {
    if (!toolsOpen) return;
    toolsMenuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setToolsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreToolsFocusRef.current = true;
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [toolsOpen]);

  useEffect(() => {
    if (toolsOpen || !restoreToolsFocusRef.current) return;
    restoreToolsFocusRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => {
      toolsTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [toolsOpen]);

  function handleToolsMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])'
      )
    );
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else if (event.key === "ArrowDown") items[(current + 1) % items.length]?.focus();
    else items[(current <= 0 ? items.length : current) - 1]?.focus();
  }

  useEffect(() => {
    if (!resetAction) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      resetDialogRef.current
        ?.querySelector<HTMLElement>("[data-canvas-reset-cancel]")
        ?.focus();
    });
    const handleResetDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setResetAction(null);
        window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !resetDialogRef.current) return;
      const focusable = getFocusableElements(resetDialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleResetDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleResetDialogKeys);
    };
  }, [resetAction]);

  // Build the initial scene exactly once. Resolution order:
  //   1. If the parent SSR-passed a scene object, use it.
  //   2. If the parent SSR-passed null, build the seed from the panel SVG.
  //   3. If undefined, hit the server first (for inline-mode opens after a
  //      prior auto-save), then fall back to the seed when nothing's saved.
  useEffect(() => {
    let cancelled = false;
    setCanvasFitted(false);
    (async () => {
      const apply = (scene: unknown) => {
        if (cancelled) return;
        setInitialData(withInitialViewport(scene));
      };
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
      const savedSeedVersion =
        resolved && typeof resolved === "object"
          ? (resolved as { readoppSeedVersion?: unknown }).readoppSeedVersion
          : undefined;
      const matchesVisiblePanel =
        !seedVersion || savedSeedVersion === seedVersion;
      if (
        resolved &&
        typeof resolved === "object" &&
        matchesVisiblePanel &&
        !shouldReseed(resolved)
      ) {
        // eslint-disable-next-line no-console
        console.info(
          "[readopp] canvas: loaded saved scene with",
          (resolved as { elements?: unknown[] }).elements?.length ?? 0,
          "elements"
        );
        setRecoveredDraft(true);
        apply(resolved);
        return;
      }
      const seed = await buildSeedScene(
        panelContent,
        panelFormat,
        heading,
        seedSceneUrl
      );
      // eslint-disable-next-line no-console
      console.info(
        "[readopp] canvas: re-seeded from panel SVG with",
        (seed as { elements?: unknown[] }).elements?.length ?? 0,
        "elements"
      );
      setRecoveredDraft(false);
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
    seedSceneUrl,
    seedVersion,
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
      const excalidraw = api as ExcalidrawAPI;
      apiRef.current = excalidraw;
      const acceptHydrationBaseline = () => {
        if (hydrationBaselineKey.current === seedKey) return;
        hydrationBaselineKey.current = seedKey;
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        lastSceneSignature.current = sceneChangeSignature(
          excalidraw.getSceneElements(),
          excalidraw.getFiles()
        );
        const titleElement = excalidraw
          .getSceneElements()
          .map((element) => element as Record<string, unknown>)
          .find(
            (element) =>
              element.type === "text" &&
              !element.isDeleted &&
              typeof element.id === "string" &&
              typeof element.text === "string" &&
              element.text.trim() === heading.trim()
          );
        if (titleElement && typeof titleElement.id === "string") {
          headingElementIdRef.current = titleElement.id;
          if (promptForTitle && !titlePromptOpenedRef.current) {
            titlePromptOpenedRef.current = true;
            setTextComposerTargetId(titleElement.id);
            setTextDraft("");
            setTextComposerOpen(true);
          }
        }
        sceneChangedSinceOpen.current = false;
        setSaving({ kind: "idle" });
      };
      // initialData.scrollToContent is not consistently honoured after the
      // dynamic Excalidraw mount, especially inside a narrow mobile route.
      // Fit imperatively once the canvas has real dimensions so a complete
      // 1080×1080 panel is visible instead of opening at a cropped 100% zoom.
      if (viewportFitKey.current !== seedKey) {
        const fitViewport = (attempt = 0) => {
          if (viewportFitKey.current === seedKey) {
            setCanvasFitted(true);
            return;
          }
          const elements = excalidraw.getSceneElements();
          if (!elements.length) {
            if (attempt < 4) {
              window.setTimeout(() => fitViewport(attempt + 1), 180);
            } else {
              // Never trap the user behind the fitting veil if a genuinely
              // blank canvas has no bounds to fit.
              acceptHydrationBaseline();
              setCanvasFitted(true);
            }
            return;
          }
          viewportFitKey.current = seedKey;
          excalidraw.scrollToContent(elements, {
            fitToViewport: true,
            viewportZoomFactor: window.matchMedia("(max-width: 767px)").matches
              ? 1.12
              : 0.94,
            animate: false,
          });
          requestAnimationFrame(() => {
            acceptHydrationBaseline();
            setCanvasFitted(true);
          });
        };
        requestAnimationFrame(() => {
          // Excalidraw applies restored appState shortly after exposing its
          // imperative API. Waiting for that hydration prevents the saved
          // 100% viewport from immediately overriding this fit.
          window.setTimeout(() => {
            fitViewport();
          }, 350);
        });
      } else {
        setCanvasFitted(true);
      }
      if (!libraryStarted.current) {
        libraryStarted.current = true;
        void handleLoadLibrary();
      }
    },
    [handleLoadLibrary, heading, promptForTitle, seedKey]
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
        readoppSeedVersion: seedVersion,
        elements: api.getSceneElements(),
        appState: stripVolatileAppState(api.getAppState()),
        // Excalidraw retains binary files after their image elements are
        // deleted. Persist only files still referenced by live elements so
        // an editing session does not grow forever and eventually fail save.
        files: sceneFilesForElements(api.getSceneElements(), api.getFiles()),
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
      setSaving({ kind: "saved", at: Date.now(), scope: "draft" });
      return true;
    } catch (e) {
      setSaving({
        kind: "error",
        message: (e as Error).message?.slice(0, 80) || "network error",
      });
      return false;
    }
  }, [explainerId, sectionId, seedVersion]);

  /**
   * Debounced background save — fires 1.5s after the last edit. The explicit
   * Save button bypasses the debounce. The first onChange after hydration is
   * ignored so opening the editor doesn't mark the panel dirty.
   */
  const scheduleSave = useCallback((elements: readonly unknown[], appState: unknown, files: Record<string, unknown>) => {
    const nextSelectedText = selectedCanvasText(elements, appState);
    if (
      nextSelectedText?.id !== selectedTextRef.current?.id ||
      nextSelectedText?.text !== selectedTextRef.current?.text
    ) {
      selectedTextRef.current = nextSelectedText;
      setSelectedText(nextSelectedText);
    }
    const signature = sceneChangeSignature(elements, files);
    if (lastSceneSignature.current === null) {
      lastSceneSignature.current = signature;
      return;
    }
    if (signature === lastSceneSignature.current) return;
    lastSceneSignature.current = signature;
    sceneChangedSinceOpen.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving({ kind: "dirty" });
    saveTimer.current = setTimeout(() => {
      void flushSave();
    }, 1500);
  }, [flushSave]);

  useEffect(() => {
    const hasPendingChanges =
      saving.kind === "dirty" ||
      saving.kind === "saving" ||
      (saving.kind === "saved" && saving.scope === "draft");
    if (!hasPendingChanges) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [saving.kind]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

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
        // The committed SVG is an in-app visual override, not a standalone
        // font archive. Keeping font-family references avoids Excalidraw's
        // optional font-subsetting worker (which Next 14 can resolve to a
        // file:// chunk URL in development) while preserving all native
        // vector/text geometry. PNG export still renders from the live scene.
        skipInliningFonts: true,
      });
      return new XMLSerializer().serializeToString(svgEl);
    } catch {
      return null;
    }
  }, []);

  /**
   * Commit the rendered canvas to the panel shown everywhere else. Inline
   * mode supplies onCommit so its parent state updates immediately; the
   * standalone editor uses the same panel PATCH endpoint directly.
   */
  const commitPanelSvg = useCallback(
    async (svg: string, canvasHeading?: string) => {
      if (onCommit) {
        await onCommit(svg);
        return;
      }
      const res = await fetch(
        `/api/explainers/${explainerId}/panels/${sectionId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: commitAsCanvasOverride ? markCanvasOverride(svg) : svg,
            ...(canvasHeading && canvasHeading !== heading
              ? { heading: canvasHeading }
              : {}),
          }),
        }
      );
      if (!res.ok) {
        let detail = `Save failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) detail = body.error;
        } catch {
          // Keep the status fallback when the response is not JSON.
        }
        throw new Error(detail);
      }
    },
    [commitAsCanvasOverride, explainerId, heading, sectionId, onCommit]
  );

  const canvasHeading = useCallback(() => {
    const titleId = headingElementIdRef.current;
    if (!titleId || !apiRef.current) return undefined;
    const titleElement = apiRef.current
      .getSceneElements()
      .map((element) => element as Record<string, unknown>)
      .find(
        (element) =>
          element.id === titleId &&
          element.type === "text" &&
          !element.isDeleted &&
          typeof element.text === "string"
      );
    if (!titleElement || typeof titleElement.text !== "string") return undefined;
    const next = titleElement.text.replace(/\s+/g, " ").trim().slice(0, 140);
    return next || undefined;
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
    const svg = await exportSceneAsSvg();
    if (!svg) {
      if (!sceneOk) return false;
      setSaving({ kind: "error", message: "Could not export canvas" });
      return false;
    }
    try {
      setSaving({ kind: "saving" });
      await commitPanelSvg(svg, canvasHeading());
      sceneChangedSinceOpen.current = false;
      setRecoveredDraft(false);
      setSaving(
        sceneOk
          ? { kind: "saved", at: Date.now(), scope: "panel" }
          : {
              kind: "error",
              message: "Panel saved, but canvas recovery could not be saved",
            }
      );
      return true;
    } catch (e) {
      setSaving({
        kind: "error",
        message: (e as Error).message?.slice(0, 80) || "commit failed",
      });
      return false;
    }
  }, [flushSave, exportSceneAsSvg, commitPanelSvg, canvasHeading]);

  const handleDone = useCallback(async () => {
    if (!sceneChangedSinceOpen.current) {
      allowNavigation.current = true;
      if (returnHref) window.location.assign(returnHref);
      return;
    }
    const committed = await handleSave();
    if (!committed) return;
    allowNavigation.current = true;
    if (returnHref) window.location.assign(returnHref);
  }, [handleSave, returnHref]);

  const handlePanelNavigation = useCallback(
    async (href: string) => {
      if (!sceneChangedSinceOpen.current) {
        allowNavigation.current = true;
        window.location.assign(href);
        return;
      }
      const committed = await handleSave();
      if (!committed) return;
      allowNavigation.current = true;
      window.location.assign(href);
    },
    [handleSave]
  );

  /**
   * Escape hatch when the canvas opens blank or stuck. Wipes the saved
   * scene server-side, rebuilds the seed from the current panel SVG,
   * and swaps it in as the new initial data. Excalidraw remounts via
   * the `key` we change downstream so the new scene takes effect.
   */
  const handleRestoreFromPanel = useCallback(async () => {
    // Cancel any pending auto-save so we don't immediately re-persist
    // whatever Excalidraw had on screen.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setCanvasFitted(false);
    try {
      await fetch(`/api/scenes/${explainerId}/${sectionId}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch {
      // Even if the server delete fails, fall through and reseed locally.
    }
    const seed = await buildSeedScene(
      panelContent,
      panelFormat,
      heading,
      seedSceneUrl
    );
    // eslint-disable-next-line no-console
    console.info(
      "[readopp] canvas: restored from panel, seeded",
      (seed as { elements?: unknown[] }).elements?.length ?? 0,
      "elements"
    );
    // Reset the dirty/signature tracking so the reseeded scene doesn't
    // immediately count as an edit.
    lastSceneSignature.current = null;
    sceneChangedSinceOpen.current = false;
    setRecoveredDraft(false);
    setSaving({ kind: "idle" });
    setInitialData(withInitialViewport(seed));
    setSeedKey((k) => k + 1);
  }, [explainerId, sectionId, panelContent, panelFormat, heading, seedSceneUrl]);

  const handleStartBlank = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setCanvasFitted(false);
    await fetch(`/api/scenes/${explainerId}/${sectionId}`, {
      method: "DELETE",
    }).catch(() => {});
    lastSceneSignature.current = null;
    sceneChangedSinceOpen.current = false;
    setRecoveredDraft(false);
    setSaving({ kind: "idle" });
    setInitialData(withInitialViewport(blankCanvasScene()));
    setSeedKey((key) => key + 1);
  }, [explainerId, sectionId]);

  const handleImport = useCallback(async (file: File | undefined) => {
    const api = apiRef.current;
    if (!api || !file) return;
    setImporting(true);
    setImportFeedback(null);
    try {
      const current = [...api.getSceneElements()];
      const name = file.name.toLowerCase();
      let inserted: readonly unknown[] = [];
      let editable = false;

      if (name.endsWith(".excalidraw") || file.type === "application/json") {
        const imported = JSON.parse(await file.text()) as {
          elements?: readonly unknown[];
          files?: Record<string, unknown>;
        };
        const elements = Array.isArray(imported.elements) ? imported.elements : [];
        if (!elements.length) throw new Error("The canvas file has no elements.");
        const files = Object.values(imported.files ?? {});
        if (files.length) api.addFiles(files);
        inserted = elements;
        editable = true;
        api.updateScene({ elements: [...current, ...elements] });
      } else if (file.type === "image/svg+xml" || name.endsWith(".svg")) {
        const converted = svgToExcalidrawElements(await file.text(), {
          offsetX: 160,
          offsetY: 160,
        });
        if (!converted?.elements.length) {
          throw new Error("This SVG could not be converted into editable paths.");
        }
        inserted = converted.elements;
        editable = true;
        api.updateScene({ elements: [...current, ...converted.elements] });
      } else if (file.type.startsWith("image/")) {
        const prepared = await prepareCanvasImage(file);
        const { dataURL, width, height, mimeType } = prepared;
        const maxSide = 560;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const fileId = `readopp-import-${Date.now().toString(36)}`;
        api.addFiles([{
          id: fileId,
          mimeType,
          dataURL,
          created: Date.now(),
          lastRetrieved: Date.now(),
          status: "saved",
        }]);
        const importedImage = imageElement({
          id: `imported-image-${Date.now().toString(36)}`,
          fileId,
          x: 180,
          y: 180,
          width: Math.max(1, width * scale),
          height: Math.max(1, height * scale),
          locked: false,
        });
        inserted = [importedImage];
        api.updateScene({ elements: [...current, importedImage] });
      } else {
        throw new Error("Import an SVG, PNG, JPG, WEBP, or .excalidraw file.");
      }
      // Imported artwork may land outside the user's current pan/zoom. Move
      // directly to the new editable elements so the successful import never
      // looks like it disappeared.
      if (inserted.length) {
        requestAnimationFrame(() =>
          api.scrollToContent(inserted, {
            fitToViewport: true,
            viewportZoomFactor: 0.72,
            animate: true,
            duration: 260,
          })
        );
      }
      setSaving({ kind: "dirty" });
      setImportFeedback({
        kind: "success",
        message: editable
          ? `Imported “${file.name}” as ${inserted.length} editable element${inserted.length === 1 ? "" : "s"}.`
          : `Imported “${file.name}” as an editable canvas image.`,
      });
    } catch (error) {
      setImportFeedback({
        kind: "error",
        message: (error as Error).message || "Could not import this file.",
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, []);

  /**
   * Mobile browsers can select Excalidraw's text tool but do not always
   * deliver the follow-up touch that creates its WYSIWYG editor. This small
   * canvas-native composer inserts a real Excalidraw text element instead.
   * The result is selected immediately and remains movable, resizable, and
   * editable with Excalidraw's normal controls — it is not a separate copy
   * editor or an SVG overlay.
   */
  const handleCommitText = useCallback(async () => {
    const api = apiRef.current;
    const text = textDraft.trim();
    if (!api || !text) return;

    const current = [...api.getSceneElements()] as Array<Record<string, unknown>>;
    const bounds = sceneElementBounds(current);
    const mod = await import("@excalidraw/excalidraw");
    const target = textComposerTargetId
      ? current.find(
          (element) =>
            element.id === textComposerTargetId &&
            element.type === "text" &&
            !element.isDeleted
        )
      : undefined;
    const skeleton = target
      ? editableTextSkeleton(target, text)
      : {
        type: "text",
        text,
        x: bounds.x + Math.max(48, bounds.width * 0.1),
        y: bounds.y + Math.max(72, bounds.height * 0.44),
        fontSize: 36,
        fontFamily: 2,
        strokeColor: "#191817",
        textAlign: "left",
        verticalAlign: "top",
      };
    const [inserted] = mod.convertToExcalidrawElements(
      [skeleton as never],
      target ? { regenerateIds: false } : undefined
    );
    if (!inserted) return;
    const finalElement = target
      ? inserted
      : {
          ...inserted,
          ...findOpenTextPosition(
            current,
            Number(inserted.width) || 240,
            Number(inserted.height) || 48,
            bounds
          ),
        };

    const nextElements = target
      ? current.map((element) =>
          element.id === textComposerTargetId ? finalElement : element
        )
      : [...current, finalElement];
    const appState = api.getAppState();
    api.updateScene({
      elements: nextElements,
      appState: {
        ...(appState && typeof appState === "object" ? appState : {}),
        selectedElementIds: { [finalElement.id]: true },
      },
    });
    api.setActiveTool({ type: "selection" });
    setTextDraft("");
    setTextComposerTargetId(null);
    setTextComposerOpen(false);
    setSaving({ kind: "dirty" });
  }, [textComposerTargetId, textDraft]);

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

  function restoreFromTools() {
    setToolsOpen(false);
    requestReset("restore", toolsTriggerRef.current);
  }

  function startBlankFromTools() {
    setToolsOpen(false);
    requestReset("blank", toolsTriggerRef.current);
  }

  function requestReset(action: "restore" | "blank", returnFocusTo?: HTMLElement | null) {
    resetTriggerRef.current =
      returnFocusTo ?? (document.activeElement as HTMLElement | null);
    setResetAction(action);
  }

  function closeResetDialog() {
    setResetAction(null);
    window.requestAnimationFrame(() => resetTriggerRef.current?.focus());
  }

  function confirmReset() {
    const action = resetAction;
    closeResetDialog();
    if (action === "restore") void handleRestoreFromPanel();
    if (action === "blank") void handleStartBlank();
  }

  function importFromTools() {
    setToolsOpen(false);
    importInputRef.current?.click();
  }

  function addTextFromTools() {
    setToolsOpen(false);
    setTextComposerTargetId(null);
    setTextDraft("");
    setTextComposerOpen(true);
  }

  function editSelectedTextFromTools() {
    if (!selectedText) return;
    setToolsOpen(false);
    setTextComposerTargetId(selectedText.id);
    setTextDraft(selectedText.text);
    setTextComposerOpen(true);
  }

  const editingPanelTitle =
    Boolean(textComposerTargetId) &&
    textComposerTargetId === headingElementIdRef.current;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sticky action strip above the canvas so it can't collide with
          Excalidraw's own top toolbar. */}
      <div
        data-testid="canvas-action-strip"
        className="relative flex shrink-0 flex-wrap items-center justify-end gap-1 border-b border-paper-line bg-surface px-1.5 py-1.5 sm:gap-1.5 sm:px-2"
      >
        <span
          data-testid="canvas-direct-edit-hint"
          className="mr-auto hidden min-w-0 text-[10px] leading-tight text-ink-muted xl:block"
        >
          Double-click text to rewrite · drag any element to move it
        </span>
        <span
          data-testid="canvas-mobile-edit-hint"
          className="order-last w-full truncate px-1 text-center text-[9px] leading-tight text-ink-muted sm:hidden"
        >
          {selectedText
            ? "Text selected · open Tools to rewrite, or drag it to move"
            : "Tap text to select · use Tools to rewrite · drag anything to move"}
        </span>
        <span
          aria-live="polite"
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] sm:text-[10px] " +
            (saving.kind === "idle" ? "hidden sm:inline " : "inline ") +
            (saving.kind === "error"
              ? "bg-rose/15 text-rose-deep"
              : "bg-paper text-ink-muted")
          }
          title={saving.kind === "error" ? saving.message : undefined}
        >
          <span className="sm:hidden">
            {saving.kind === "idle" && "Ready"}
            {saving.kind === "dirty" && "Unsaved"}
            {saving.kind === "saving" && "Saving…"}
            {saving.kind === "saved" &&
              (saving.scope === "panel" ? "Panel saved" : "Draft saved")}
            {saving.kind === "error" && "Error"}
          </span>
          <span className="hidden sm:inline">
            {saving.kind === "idle" && "Draft auto-save on"}
            {saving.kind === "dirty" && "Saving draft in 1.5s"}
            {saving.kind === "saving" && "Saving…"}
            {saving.kind === "saved" &&
              (saving.scope === "panel" ? "Panel saved" : "Draft saved")}
            {saving.kind === "error" && `Needs attention · ${saving.message.slice(0, 60)}`}
          </span>
        </span>
        {saving.kind === "idle" && recoveredDraft && (
          <span
            data-testid="canvas-recovery-status"
            className="shrink-0 rounded-full bg-sage/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-sage-deep sm:text-[10px]"
            title="Your last auto-saved canvas draft was restored"
          >
            <span className="sm:hidden">Restored</span>
            <span className="hidden sm:inline">Draft restored</span>
          </span>
        )}
        <details className="group relative hidden sm:block xl:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink">
            Edit tips
          </summary>
          <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-paper-line bg-surface p-3 text-[11px] leading-5 text-ink-soft shadow-[0_14px_36px_rgba(15,23,42,.18)]">
            <p><b className="text-ink">Text:</b> double-click to rewrite it.</p>
            <p><b className="text-ink">Anything else:</b> click to move, resize, recolor, or delete it.</p>
            <p><b className="text-ink">Canvas:</b> drag with the hand tool or hold the space bar.</p>
          </div>
        </details>
        <button
          type="button"
          onClick={() => requestReset("restore")}
          title="Discard canvas edits and restore the original panel"
          className="hidden shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink 2xl:block"
        >
          Restore from panel
        </button>
        <button
          type="button"
          onClick={() => requestReset("blank")}
          title="Remove the template base and design this panel from scratch"
          className="hidden shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink 2xl:block"
        >
          Start blank
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp,.excalidraw,application/json,image/*"
          className="sr-only"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
          title="Import editable SVG paths, an image, or an Excalidraw scene"
          className="hidden shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink-muted transition hover:border-ink-muted hover:text-ink disabled:opacity-60 2xl:block"
        >
          {importing ? "Importing…" : "Import"}
        </button>
        <div ref={toolsRef} className="relative 2xl:hidden">
          <button
            ref={toolsTriggerRef}
            type="button"
            onClick={() => setToolsOpen((open) => !open)}
            aria-expanded={toolsOpen}
            aria-haspopup="menu"
            aria-label="Canvas tools"
            className={
              "min-h-8 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition sm:min-h-0 " +
              (toolsOpen
                ? "border-accent bg-accent-soft text-accent-deep"
                : "border-paper-line bg-paper text-ink-muted hover:border-ink-muted hover:text-ink")
            }
          >
            Tools
          </button>
          {toolsOpen && (
            <div
              ref={toolsMenuRef}
              role="menu"
              aria-label="Canvas creation and recovery tools"
              onKeyDown={handleToolsMenuKeyDown}
              className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-paper-line bg-surface p-1.5 shadow-[0_14px_36px_rgba(15,23,42,.18)]"
            >
              {selectedText ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={editSelectedTextFromTools}
                  className="block w-full rounded-md bg-accent-soft px-3 py-2 text-left text-xs font-medium text-accent-deep hover:bg-accent/15"
                >
                  Edit selected text
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={addTextFromTools}
                className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-ink hover:bg-paper-soft"
              >
                Add text to canvas
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={importFromTools}
                disabled={importing}
                className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-ink hover:bg-paper-soft disabled:opacity-60"
              >
                {importing ? "Importing…" : "Import artwork or scene"}
              </button>
              <div className="my-1 border-t border-paper-line" />
              <button
                type="button"
                role="menuitem"
                onClick={restoreFromTools}
                className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
              >
                Restore original panel
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={startBlankFromTools}
                className="block w-full rounded-md px-3 py-2 text-left text-xs text-ink-soft hover:bg-paper-soft hover:text-ink"
              >
                Start with a blank canvas
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving.kind === "saving"}
          className="min-h-8 shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink transition hover:border-ink-muted disabled:opacity-60 sm:min-h-0"
        >
          Save panel
        </button>
        {previousPanelHref ? (
          <button
            type="button"
            onClick={() => void handlePanelNavigation(previousPanelHref)}
            disabled={saving.kind === "saving"}
            aria-label={`Save and edit previous panel${previousPanelLabel ? `: ${previousPanelLabel}` : ""}`}
            title={previousPanelLabel ? `Previous: ${previousPanelLabel}` : "Previous panel"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-paper-line bg-paper text-[11px] font-medium text-ink transition hover:border-ink-muted disabled:opacity-60 sm:hidden"
          >
            ←
          </button>
        ) : null}
        {nextPanelHref ? (
          <button
            type="button"
            onClick={() => void handlePanelNavigation(nextPanelHref)}
            disabled={saving.kind === "saving"}
            aria-label={`Save and edit next panel${nextPanelLabel ? `: ${nextPanelLabel}` : ""}`}
            title={nextPanelLabel ? `Next: ${nextPanelLabel}` : "Next panel"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-paper-line bg-paper text-[11px] font-medium text-ink transition hover:border-ink-muted disabled:opacity-60 sm:hidden"
          >
            →
          </button>
        ) : null}
        {previousPanelHref ? (
          <button
            type="button"
            onClick={() => void handlePanelNavigation(previousPanelHref)}
            disabled={saving.kind === "saving"}
            aria-label={`Save and edit previous panel${previousPanelLabel ? `: ${previousPanelLabel}` : ""}`}
            title={previousPanelLabel ? `Previous: ${previousPanelLabel}` : "Previous panel"}
            className="hidden shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink transition hover:border-ink-muted disabled:opacity-60 sm:block"
          >
            ← Previous
          </button>
        ) : null}
        {nextPanelHref ? (
          <button
            type="button"
            onClick={() => void handlePanelNavigation(nextPanelHref)}
            disabled={saving.kind === "saving"}
            aria-label={`Save and edit next panel${nextPanelLabel ? `: ${nextPanelLabel}` : ""}`}
            title={nextPanelLabel ? `Next: ${nextPanelLabel}` : "Next panel"}
            className="hidden shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink transition hover:border-ink-muted disabled:opacity-60 sm:block"
          >
            Next →
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="min-h-8 shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60 sm:min-h-0"
        >
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
        {returnHref && (
          <button
            type="button"
            onClick={() => void handleDone()}
            className="min-h-8 shrink-0 rounded-full border border-paper-line bg-paper px-2.5 py-1 text-[10px] font-medium text-ink transition hover:border-ink-muted sm:min-h-0"
          >
            Done
          </button>
        )}
      </div>

      {importFeedback ? (
        <div
          data-testid="canvas-import-status"
          role={importFeedback.kind === "error" ? "alert" : "status"}
          className={
            "flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-[11px] leading-4 " +
            (importFeedback.kind === "error"
              ? "border-coral/30 bg-coral-soft text-coral-deep"
              : "border-sage/35 bg-sage-soft text-sage-deep")
          }
        >
          <span>{importFeedback.message}</span>
          <button
            type="button"
            aria-label="Dismiss import status"
            onClick={() => setImportFeedback(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current/20 text-sm leading-none hover:bg-paper/35"
          >
            ×
          </button>
        </div>
      ) : null}

      {textComposerOpen ? (
        <form
          data-testid="canvas-text-composer"
          className="flex shrink-0 flex-wrap items-end gap-1.5 border-b border-paper-line bg-paper-soft px-2 py-2 sm:flex-nowrap sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCommitText();
          }}
        >
          <label htmlFor={`canvas-text-${sectionId}`} className="sr-only">
            {editingPanelTitle
              ? "Panel title"
              : textComposerTargetId
                ? "Edit selected canvas text"
              : "Text to add to this panel"}
          </label>
          <textarea
            id={`canvas-text-${sectionId}`}
            autoFocus
            rows={2}
            maxLength={editingPanelTitle ? 140 : undefined}
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              editingPanelTitle
                ? "Write a clear panel title"
                : textComposerTargetId
                  ? "Rewrite selected text"
                  : "Type text for this panel"
            }
            className="max-h-28 min-h-14 w-full min-w-0 resize-y rounded-xl border border-paper-line bg-surface px-3 py-2 text-[12px] leading-5 text-ink outline-none transition placeholder:text-ink-muted focus:border-accent sm:min-h-0 sm:flex-1"
          />
          <button
            type="submit"
            disabled={!textDraft.trim()}
            className="min-h-8 shrink-0 rounded-full bg-ink px-3 py-1 text-[10px] font-medium text-paper disabled:opacity-40 sm:min-h-0"
          >
            {editingPanelTitle
              ? "Use title"
              : textComposerTargetId
                ? "Update text"
                : "Add to canvas"}
          </button>
          <button
            type="button"
            aria-label="Close text composer"
            onClick={() => {
              setTextDraft("");
              setTextComposerTargetId(null);
              setTextComposerOpen(false);
            }}
            className="min-h-8 shrink-0 rounded-full border border-paper-line bg-surface px-2.5 py-1 text-[10px] text-ink-muted sm:min-h-0"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {resetAction ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#080d18]/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResetDialog();
          }}
        >
          <div
            ref={resetDialogRef}
            data-testid="canvas-reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="canvas-reset-title"
            aria-describedby="canvas-reset-description"
            tabIndex={-1}
            className="w-full max-w-md rounded-[24px] border border-paper-line bg-surface p-5 shadow-[0_30px_90px_rgba(0,0,0,.32)] sm:p-6"
          >
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-coral-deep">
              Canvas recovery
            </div>
            <h2 id="canvas-reset-title" className="mt-2 font-display text-2xl font-medium tracking-[-.025em] text-ink">
              {resetAction === "restore" ? "Restore the saved panel?" : "Start with a blank canvas?"}
            </h2>
            <p id="canvas-reset-description" className="mt-3 text-sm leading-6 text-ink-soft">
              {resetAction === "restore"
                ? "This discards the current canvas draft and rebuilds the editor from the last saved panel. Your saved panel stays unchanged."
                : "This removes every element from the canvas so you can design from scratch. Your saved panel stays unchanged until you choose Save panel."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                data-canvas-reset-cancel
                type="button"
                onClick={closeResetDialog}
                className="rounded-full border border-paper-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-muted"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="rounded-full bg-coral-deep px-4 py-2 text-sm font-medium text-white transition hover:bg-coral-deep/90"
              >
                {resetAction === "restore" ? "Restore panel" : "Start blank"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
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
        {initialData && !canvasFitted ? (
          <div
            data-testid="canvas-fitting"
            className="absolute inset-0 z-40 grid place-items-center bg-paper/95 text-[11px] font-medium text-ink-muted backdrop-blur-[1px]"
          >
            Fitting the complete panel…
          </div>
        ) : null}
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

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}

// ---------- Seeding ----------

/**
 * Excalidraw otherwise opens every scene at its default 100% origin. That is
 * workable on a desktop but makes a 1080px social panel look cropped on a
 * phone. This one-time import hint centers the complete panel at a useful
 * zoom without persisting viewport-only state back into the user's scene.
 */
function withInitialViewport(scene: unknown): unknown {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) return scene;
  return { ...(scene as Record<string, unknown>), scrollToContent: true };
}

/**
 * Build the initial scene for a panel that hasn't been edited before.
 *
 * Suggested layouts arrive from the server as native Excalidraw elements.
 * For other SVG panels we first try to parse the SVG into native Excalidraw
 * elements (text, rect, line, ellipse, polyline) — that's what makes
 * individual headings, captions, shapes, and squiggles editable. If the
 * parser fails (malformed SVG, unsupported features) we fall back to
 * the legacy path: embed the whole SVG as a locked image so the user
 * at least sees their panel.
 */
async function buildSeedScene(
  panelContent: string,
  panelFormat: "svg" | "html",
  heading: string,
  seedSceneUrl?: string
): Promise<unknown> {
  if (seedSceneUrl) {
    try {
      const response = await fetch(seedSceneUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Template seed failed (${response.status})`);
      }
      const body = (await response.json()) as { scene?: unknown };
      if (!body.scene || typeof body.scene !== "object") {
        throw new Error("Template seed did not contain a scene");
      }
      return body.scene;
    } catch (error) {
      // Keep the editor usable if the editable layout endpoint is unavailable.
      // eslint-disable-next-line no-console
      console.warn(
        `[readopp] canvas template seed failed; falling back to panel SVG: ${(error as Error).message}`
      );
    }
  }

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
  const converted = svgToExcalidrawElements(panelContent, {
    offsetX: SEED_OFFSET_X,
    offsetY: SEED_OFFSET_Y,
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read panel image"));
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 560,
      height: image.naturalHeight || 560,
    });
    image.onerror = () => reject(new Error("Could not read the image dimensions."));
    image.src = dataUrl;
  });
}

/**
 * Keep imported photos useful for design work without embedding a multi-MB
 * camera original into every auto-save. SVGs stay vector; raster images are
 * resized to a generous working resolution and encoded as WebP.
 */
async function prepareCanvasImage(file: File): Promise<{
  dataURL: string;
  width: number;
  height: number;
  mimeType: string;
}> {
  const original = await blobToDataUrl(file);
  const dimensions = await imageDimensions(original);
  const longestSide = Math.max(dimensions.width, dimensions.height);
  const shouldOptimize = file.size > 160_000 || longestSide > 1400;
  if (!shouldOptimize) {
    return {
      dataURL: original,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: file.type || "image/png",
    };
  }

  const scale = Math.min(1, 1400 / longestSide);
  let width = Math.max(1, Math.round(dimensions.width * scale));
  let height = Math.max(1, Math.round(dimensions.height * scale));
  const image = new Image();
  image.src = original;
  await image.decode();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this image for the canvas.");
  let quality = 0.78;
  let dataURL = "";
  do {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    dataURL = canvas.toDataURL("image/webp", quality);
    if (dataURL.length <= 160_000 || Math.max(width, height) <= 420) break;
    const nextScale = Math.max(
      0.68,
      Math.min(0.88, Math.sqrt(160_000 / dataURL.length) * 0.96)
    );
    width = Math.max(1, Math.round(width * nextScale));
    height = Math.max(1, Math.round(height * nextScale));
    quality = Math.max(0.52, quality - 0.06);
  } while (true);
  return {
    dataURL,
    width,
    height,
    mimeType: "image/webp",
  };
}

function blankCanvasScene(): unknown {
  return {
    type: "excalidraw",
    version: 2,
    source: "readopp",
    elements: [],
    appState: { viewBackgroundColor: "#FAF9F5" },
    files: {},
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
  locked?: boolean;
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
    locked: args.locked ?? true,
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

function sceneElementBounds(elements: Array<Record<string, unknown>>) {
  const visible = elements.filter(
    (element) =>
      !element.isDeleted &&
      Number.isFinite(element.x) &&
      Number.isFinite(element.y) &&
      Number.isFinite(element.width) &&
      Number.isFinite(element.height)
  );
  if (!visible.length) return { x: 0, y: 0, width: 1080, height: 1080 };

  const minX = Math.min(...visible.map((element) => Number(element.x)));
  const minY = Math.min(...visible.map((element) => Number(element.y)));
  const maxX = Math.max(
    ...visible.map((element) => Number(element.x) + Number(element.width))
  );
  const maxY = Math.max(
    ...visible.map((element) => Number(element.y) + Number(element.height))
  );
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function findOpenTextPosition(
  elements: Array<Record<string, unknown>>,
  width: number,
  height: number,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const panelArea = bounds.width * bounds.height;
  const obstacleGutter = Math.max(
    18,
    Math.min(bounds.width, bounds.height) * 0.025
  );
  const obstacles = elements
    .filter((element) => {
      if (element.isDeleted || element.type === "line" || element.type === "arrow") {
        return false;
      }
      const obstacleWidth = Number(element.width);
      const obstacleHeight = Number(element.height);
      return (
        Number.isFinite(element.x) &&
        Number.isFinite(element.y) &&
        Number.isFinite(obstacleWidth) &&
        Number.isFinite(obstacleHeight) &&
        obstacleWidth > 0 &&
        obstacleHeight > 0 &&
        obstacleWidth * obstacleHeight < panelArea * 0.55
      );
    })
    .map((element) => ({
      x: Number(element.x) - obstacleGutter,
      y: Number(element.y) - obstacleGutter,
      width: Number(element.width) + obstacleGutter * 2,
      height: Number(element.height) + obstacleGutter * 2,
    }));

  const padding = Math.max(64, Math.min(bounds.width, bounds.height) * 0.075);
  const availableWidth = Math.max(1, bounds.width - padding * 2 - width);
  const availableHeight = Math.max(1, bounds.height - padding * 2 - height);
  const xStops = [0, 0.5, 1];
  const yStops = [0.08, 0.24, 0.42, 0.6, 0.78, 1];
  let best = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    score: Number.POSITIVE_INFINITY,
  };

  for (const yStop of yStops) {
    for (const xStop of xStops) {
      const candidate = {
        x: bounds.x + padding + availableWidth * xStop,
        y: bounds.y + padding + availableHeight * yStop,
        width,
        height,
      };
      const overlap = obstacles.reduce(
        (total, obstacle) => total + rectangleOverlapArea(candidate, obstacle),
        0
      );
      // Prefer a clear location first. Among equally clear positions, favour
      // the upper half so freshly added copy is immediately discoverable.
      const score = overlap * 1000 + yStop * 10 + Math.abs(xStop - 0.5);
      if (score < best.score) best = { x: candidate.x, y: candidate.y, score };
    }
  }
  return { x: best.x, y: best.y };
}

function rectangleOverlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const width = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const height = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return width * height;
}

function selectedCanvasText(
  elements: readonly unknown[],
  appState: unknown
): { id: string; text: string } | null {
  if (!appState || typeof appState !== "object") return null;
  const selectedIds = (appState as { selectedElementIds?: unknown })
    .selectedElementIds;
  if (!selectedIds || typeof selectedIds !== "object") return null;
  const selectedId = Object.entries(selectedIds as Record<string, unknown>)
    .find(([, selected]) => Boolean(selected))?.[0];
  if (!selectedId) return null;
  const element = elements.find((value) => {
    const candidate = value as { id?: unknown; type?: unknown; isDeleted?: unknown };
    return (
      candidate.id === selectedId &&
      candidate.type === "text" &&
      !candidate.isDeleted
    );
  }) as { id?: unknown; text?: unknown } | undefined;
  return element && typeof element.id === "string" && typeof element.text === "string"
    ? { id: element.id, text: element.text }
    : null;
}

/** Rebuild a text element without its measured dimensions so Excalidraw
 * recalculates wrapping and bounds for the rewritten copy. Visual styling,
 * grouping, and position remain attached to the same stable element id. */
function editableTextSkeleton(
  element: Record<string, unknown>,
  text: string
): Record<string, unknown> {
  const keep = [
    "id",
    "x",
    "y",
    "angle",
    "strokeColor",
    "backgroundColor",
    "fillStyle",
    "strokeWidth",
    "strokeStyle",
    "roughness",
    "opacity",
    "groupIds",
    "frameId",
    "roundness",
    "link",
    "locked",
    "fontSize",
    "fontFamily",
    "textAlign",
    "verticalAlign",
    "lineHeight",
  ];
  const skeleton: Record<string, unknown> = { type: "text", text };
  for (const key of keep) {
    if (element[key] !== undefined) skeleton[key] = element[key];
  }
  return skeleton;
}

/**
 * Excalidraw's onChange also fires for zoom, tool, and selection changes.
 * Element versions are incremented for actual content mutations, giving us
 * a small stable fingerprint without serializing the complete scene on every
 * pointer movement.
 */
function sceneChangeSignature(
  elements: readonly unknown[],
  files: Record<string, unknown>
): string {
  const elementPart = elements
    .map((value) => {
      const element = value as {
        id?: string;
        version?: number;
        versionNonce?: number;
        isDeleted?: boolean;
      };
      return `${element.id ?? "?"}:${element.version ?? 0}:${element.versionNonce ?? 0}:${element.isDeleted ? 1 : 0}`;
    })
    .join("|");
  const filePart = Object.keys(files).sort().join("|");
  return `${elementPart}::${filePart}`;
}

function sceneFilesForElements(
  elements: readonly unknown[],
  files: Record<string, unknown>
): Record<string, unknown> {
  const referenced = new Set(
    elements.flatMap((value) => {
      const element = value as {
        type?: string;
        fileId?: string | null;
        isDeleted?: boolean;
      };
      return element.type === "image" && !element.isDeleted && element.fileId
        ? [element.fileId]
        : [];
    })
  );
  return Object.fromEntries(
    Object.entries(files).filter(([fileId]) => referenced.has(fileId))
  );
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
