"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditHistory, useUndoShortcuts } from "@/lib/edit/history";
import {
  assignStableIds,
  cloneScene,
  deleteElement,
  EDIT_ID_ATTR,
  getAttr,
  getKind,
  getTextContent,
  getViewBox,
  moveBy,
  parseScene,
  readCornerRadius,
  readFontFamily,
  readFontSize,
  readFontStyle,
  readFontWeight,
  readLineEndpoints,
  readOpacity,
  readStrokeWidth,
  readTextAnchor,
  resizeRect,
  serializeScene,
  setAttr,
  setCornerRadius,
  setFontFamily,
  setFontSize,
  setFontStyle,
  setFontWeight,
  setLineEndpoint,
  setOpacity,
  setStrokeWidth,
  setText,
  setTextAnchor,
  type ElementKind,
  type SceneGraph,
} from "@/lib/edit/sceneGraph";
import { FloatingToolbar } from "./edit/FloatingToolbar";
import {
  clientToSvg,
  SelectionOverlay,
  type Bbox,
  type EndpointKey,
  type HandleKey,
} from "./edit/SelectionOverlay";

interface Props {
  content: string;
  onSave: (next: string) => Promise<void>;
}

// Tags considered "background" — clicking these deselects.
const DRAG_THRESHOLD_PX = 3;

export function EditableSvgPanel({ content, onSave }: Props) {
  // ---------- Source-of-truth bootstrap ----------
  // Render the raw `content` initially so client hydration matches the server
  // HTML exactly. After mount we parse, assign stable ids, and reset history
  // to the ID'd version — that re-render happens post-hydration so React is fine.
  const {
    state: svg,
    push,
    replace,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditHistory(content);

  useEffect(() => {
    const scene = parseScene(content);
    if (!scene) {
      reset(content);
      setSelectedId(null);
      setTextEdit(null);
      return;
    }
    assignStableIds(scene);
    const ided = serializeScene(scene);
    reset(ided);
    setSelectedId(null);
    setTextEdit(null);
  }, [content, reset]);

  // ---------- DOM container + selection ----------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [hoverActive, setHoverActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep containerRect fresh so the floating toolbar positions correctly even
  // after the panel is resized (mobile rotation, sidebar opening, etc).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Current scene (parsed live for queries; not stored in state).
  const scene = useMemo<SceneGraph | null>(() => parseScene(svg), [svg]);
  const viewBox = useMemo(
    () => (scene ? getViewBox(scene) : null),
    [scene]
  );

  const selectedKind: ElementKind = useMemo(
    () => (scene && selectedId ? getKind(scene, selectedId) : "unknown"),
    [scene, selectedId]
  );
  const resizable = selectedKind === "rect";

  // ---------- Save (debounced — last push wins) ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(content);
  const scheduleSave = useCallback(
    (next: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (next === lastSavedRef.current) return;
        setSaving(true);
        setError(null);
        try {
          await onSave(next);
          lastSavedRef.current = next;
        } catch (e) {
          setError((e as Error).message || "Save failed");
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [onSave]
  );
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // ---------- Mutation helpers ----------
  // commitMutation — discrete edit: clone, mutate, serialize, PUSH to history,
  //                   schedule save. Use for clicks, drag releases, key presses.
  // previewMutation — streaming edit (mid-slider, mid-drag): mutate + REPLACE
  //                   the current history snapshot so we don't accumulate one
  //                   undo entry per pixel. Caller invokes commitCurrent() at
  //                   the end of the interaction (typically slider pointer-up).
  const commitMutation = useCallback(
    (mutate: (s: SceneGraph) => boolean): string | null => {
      if (!scene) return null;
      const next = cloneScene(scene);
      const ok = mutate(next);
      if (!ok) return null;
      const out = serializeScene(next);
      push(out);
      scheduleSave(out);
      return out;
    },
    [scene, push, scheduleSave]
  );
  const previewMutation = useCallback(
    (mutate: (s: SceneGraph) => boolean): string | null => {
      if (!scene) return null;
      const next = cloneScene(scene);
      const ok = mutate(next);
      if (!ok) return null;
      const out = serializeScene(next);
      replace(out);
      scheduleSave(out);
      return out;
    },
    [scene, replace, scheduleSave]
  );
  // Push the current svg onto history as a single new entry — used after a
  // chain of previewMutations to commit the whole stream as one undo step.
  const commitCurrent = useCallback(() => {
    push(svg);
  }, [push, svg]);

  // ---------- Bounding box (PIXEL space relative to panel-svg-wrap) ----------
  // Using getBoundingClientRect rather than getBBox so the overlay aligns
  // even when the SVG is letterboxed or has parent transforms.
  useEffect(() => {
    if (!selectedId || !containerRef.current) {
      setBbox(null);
      return;
    }
    const node = containerRef.current.querySelector<SVGGraphicsElement>(
      `[${EDIT_ID_ATTR}="${cssSelectorEscape(selectedId)}"]`
    );
    if (!node) {
      setBbox(null);
      return;
    }
    const cRect = containerRef.current.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    setBbox({
      x: r.left - cRect.left,
      y: r.top - cRect.top,
      width: r.width,
      height: r.height,
    });
  }, [selectedId, svg, containerRect]);

  // ---------- Mouse interactions on the panel ----------
  function onPanelClick(e: React.MouseEvent) {
    const target = e.target as Element | null;
    if (!target) {
      setSelectedId(null);
      return;
    }
    // Collect the chain of ancestor (+ self) elements that carry an
    // edit-id, nearest-first. Alt+click cycles deeper into the chain so
    // the user can reach a rect under a text without first deleting
    // the text.
    const chain: string[] = [];
    let cur: Element | null = target;
    while (cur) {
      const id = cur.getAttribute?.(EDIT_ID_ATTR);
      if (id) chain.push(id);
      cur = cur.parentElement;
      // Stop at the panel-svg-wrap (the SVG's container).
      if (cur === containerRef.current) break;
    }
    if (chain.length === 0) {
      setSelectedId(null);
      return;
    }
    if (e.altKey && selectedId) {
      const idx = chain.indexOf(selectedId);
      const next = chain[(idx + 1) % chain.length] ?? chain[0];
      setSelectedId(next);
    } else {
      setSelectedId(chain[0]);
    }
  }

  function onPanelDoubleClick(e: React.MouseEvent) {
    if (openTextEditorForSelection()) e.stopPropagation();
  }

  /** Open the inline text editor for the currently-selected text element. Returns true if opened. */
  function openTextEditorForSelection(): boolean {
    if (!selectedId || !scene) return false;
    const kind = getKind(scene, selectedId);
    if (kind !== "text") return false;
    const target = containerRef.current?.querySelector<SVGGraphicsElement>(
      `[${EDIT_ID_ATTR}="${cssSelectorEscape(selectedId)}"]`
    );
    if (!target) return false;
    const cRect = containerRef.current!.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    setTextEdit({
      id: selectedId,
      value: getTextContent(scene, selectedId),
      top: r.top - cRect.top,
      left: r.left - cRect.left,
      width: Math.max(80, r.width),
      height: Math.max(20, r.height),
    });
    return true;
  }

  // ---------- Move (drag selected element) ----------
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
    rawSvg: string;
  } | null>(null);

  function onPointerDownOnSelected(e: React.PointerEvent) {
    if (!selectedId || !scene) return;
    if (e.button !== 0) return;
    // All editable kinds are draggable. moveBy handles rect/text/circle/
    // ellipse via direct attrs, line via x1/y1/x2/y2, polyline/polygon via
    // points, and path via a translate transform.
    const kind = getKind(scene, selectedId);
    const draggable =
      kind === "rect" ||
      kind === "text" ||
      kind === "circle" ||
      kind === "ellipse" ||
      kind === "line" ||
      kind === "polyline" ||
      kind === "polygon" ||
      kind === "path" ||
      kind === "g";
    if (!draggable) return;
    dragRef.current = {
      id: selectedId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      rawSvg: svg,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    if (!viewBox || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = (dx / rect.width) * viewBox.width;
    const sy = (dy / rect.height) * viewBox.height;
    // Apply to a fresh clone of the starting svg (no accumulation).
    const base = parseScene(d.rawSvg);
    if (!base) return;
    if (!moveBy(base, d.id, sx, sy)) return;
    const out = serializeScene(base);
    // Mid-drag: replace current snapshot instead of pushing — one drag = one
    // history entry, committed on pointer-up below.
    replace(out);
  }

  function onPointerUp() {
    const d = dragRef.current;
    if (!d) return;
    if (d.moved) {
      // Commit the final position as a single new history entry.
      push(svg);
      scheduleSave(svg);
    }
    dragRef.current = null;
  }

  // ---------- Resize (handle drag) ----------
  // Bbox + pointer tracked in PIXEL space (relative to panel-svg-wrap); we
  // convert to viewBox coordinates only when writing the rect's x/y/width/
  // height attributes.
  const resizeRef = useRef<{
    id: string;
    handle: HandleKey;
    startBbox: Bbox;
    startClientX: number;
    startClientY: number;
    rawSvg: string;
  } | null>(null);

  function onHandlePointerDown(handle: HandleKey, e: React.PointerEvent) {
    if (!selectedId || !bbox || !containerRef.current || !viewBox) return;
    e.stopPropagation();
    resizeRef.current = {
      id: selectedId,
      handle,
      startBbox: { ...bbox },
      startClientX: e.clientX,
      startClientY: e.clientY,
      rawSvg: svg,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    const r = resizeRef.current;
    if (!r || !containerRef.current || !viewBox) return;
    const dxPx = e.clientX - r.startClientX;
    const dyPx = e.clientY - r.startClientY;
    let { x, y, width, height } = r.startBbox;
    const h = r.handle;
    if (h === "w") {
      x = r.startBbox.x + dxPx;
      width = r.startBbox.width - dxPx;
    }
    if (h === "e") {
      width = r.startBbox.width + dxPx;
    }
    if (h === "n") {
      y = r.startBbox.y + dyPx;
      height = r.startBbox.height - dyPx;
    }
    if (h === "s") {
      height = r.startBbox.height + dyPx;
    }
    if (e.shiftKey) {
      const ar = r.startBbox.width / r.startBbox.height;
      if (h === "n" || h === "s") width = height * ar;
      else height = width / ar;
    }
    width = Math.max(8, width);
    height = Math.max(8, height);
    // Convert pixel bbox → viewBox coords for the rect's attrs.
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    const base = parseScene(r.rawSvg);
    if (!base) return;
    if (
      !resizeRect(
        base,
        r.id,
        x * scaleX,
        y * scaleY,
        width * scaleX,
        height * scaleY
      )
    )
      return;
    replace(serializeScene(base));
  }

  function onHandlePointerUp() {
    const r = resizeRef.current;
    if (!r) return;
    push(svg);
    scheduleSave(svg);
    resizeRef.current = null;
  }

  // ---------- Line endpoint drag (independent of rect resize) ----------
  const endpointRef = useRef<{
    id: string;
    end: EndpointKey;
    rawSvg: string;
  } | null>(null);

  function onEndpointPointerDown(end: EndpointKey, e: React.PointerEvent) {
    if (!selectedId) return;
    e.stopPropagation();
    endpointRef.current = {
      id: selectedId,
      end,
      rawSvg: svg,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onEndpointPointerMove(e: React.PointerEvent) {
    const r = endpointRef.current;
    if (!r || !containerRef.current || !viewBox) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cur = clientToSvg(e, rect, viewBox);
    const base = parseScene(r.rawSvg);
    if (!base) return;
    if (!setLineEndpoint(base, r.id, r.end, cur.x, cur.y)) return;
    replace(serializeScene(base));
  }

  function onEndpointPointerUp() {
    const r = endpointRef.current;
    if (!r) return;
    push(svg);
    scheduleSave(svg);
    endpointRef.current = null;
  }

  // Compute the two line endpoints in PIXEL space for the overlay. Returns
  // null for non-line elements so the overlay falls back to edge handles.
  const lineEndpointsPx = useMemo<
    { p1: { x: number; y: number }; p2: { x: number; y: number } } | null
  >(() => {
    if (!scene || !selectedId || selectedKind !== "line") return null;
    if (!containerRef.current || !viewBox) return null;
    const ep = readLineEndpoints(scene, selectedId);
    if (!ep) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = rect.width / viewBox.width;
    const sy = rect.height / viewBox.height;
    return {
      p1: { x: ep.x1 * sx, y: ep.y1 * sy },
      p2: { x: ep.x2 * sx, y: ep.y2 * sy },
    };
  }, [scene, selectedId, selectedKind, viewBox, containerRect, svg]);

  // ---------- Inline text editor ----------
  const [textEdit, setTextEdit] = useState<{
    id: string;
    value: string;
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  function commitTextEdit(value: string) {
    if (!textEdit || !scene) {
      setTextEdit(null);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed === getTextContent(scene, textEdit.id)) {
      setTextEdit(null);
      return;
    }
    commitMutation((s) => setText(s, textEdit.id, trimmed));
    setTextEdit(null);
  }

  // ---------- Keyboard ----------
  useUndoShortcuts(hoverActive, undo, redo);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!hoverActive) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (!selectedId) return;
      if (e.key === "Escape") {
        setSelectedId(null);
        setTextEdit(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        commitMutation((s) => deleteElement(s, selectedId));
        setSelectedId(null);
        return;
      }
      // Arrow nudge: 1px, Shift+Arrow = 16px. One history entry per press.
      const NUDGE = e.shiftKey ? 16 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -NUDGE;
      else if (e.key === "ArrowRight") dx = NUDGE;
      else if (e.key === "ArrowUp") dy = -NUDGE;
      else if (e.key === "ArrowDown") dy = NUDGE;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      commitMutation((s) => moveBy(s, selectedId, dx, dy));
    }
    if (!hoverActive) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoverActive, selectedId, commitMutation]);

  // ---------- Render ----------
  return (
    <div
      className="relative"
      onMouseEnter={() => setHoverActive(true)}
      onMouseLeave={() => setHoverActive(false)}
    >
      <div
        ref={containerRef}
        className={
          "panel-svg-wrap relative select-none " +
          (hoveredId && hoveredId === selectedId
            ? "cursor-move"
            : hoveredId
            ? "cursor-pointer"
            : "cursor-default")
        }
        onClick={onPanelClick}
        onDoubleClick={onPanelDoubleClick}
        onPointerDown={onPointerDownOnSelected}
        onPointerMove={(e) => {
          if (dragRef.current) onPointerMove(e);
          if (resizeRef.current) onHandlePointerMove(e);
          if (endpointRef.current) onEndpointPointerMove(e);
        }}
        onPointerUp={() => {
          if (dragRef.current) onPointerUp();
          if (resizeRef.current) onHandlePointerUp();
          if (endpointRef.current) onEndpointPointerUp();
        }}
        onMouseMove={(e) => {
          if (dragRef.current || resizeRef.current) return;
          const target = e.target as Element | null;
          const node = target?.closest?.(`[${EDIT_ID_ATTR}]`);
          const id = node?.getAttribute?.(EDIT_ID_ATTR) ?? null;
          if (id !== hoveredId) setHoveredId(id);
        }}
        onMouseLeave={() => setHoveredId(null)}
        style={{ position: "relative" }}
      >
        {/* SVG content — wrapped in its own div so the selection overlay can
           sit beside it inside panel-svg-wrap (whose box matches the SVG's). */}
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {bbox && (
          <SelectionOverlay
            bbox={bbox}
            resizable={resizable}
            onHandlePointerDown={onHandlePointerDown}
            lineEndpoints={lineEndpointsPx ?? undefined}
            onEndpointPointerDown={onEndpointPointerDown}
          />
        )}
      </div>
      <HoverStyle hoveredId={hoveredId} selectedId={selectedId} />
      {textEdit && (
        <InlineTextInput
          textEdit={textEdit}
          onCommit={commitTextEdit}
          onCancel={() => setTextEdit(null)}
        />
      )}

      {/* Floating contextual toolbar — only when something is selected */}
      {selectedId && scene && bbox && viewBox && (() => {
        const fill = getAttr(scene, selectedId, "fill");
        const stroke = getAttr(scene, selectedId, "stroke");
        const hasFill = fill !== null && fill !== "none" && fill !== "transparent";
        const hasStroke = stroke !== null && stroke !== "none";
        const canFill =
          selectedKind === "rect" ||
          selectedKind === "text" ||
          selectedKind === "tspan" ||
          selectedKind === "circle" ||
          selectedKind === "ellipse" ||
          selectedKind === "polygon" ||
          selectedKind === "path";
        const canStroke = selectedKind !== "text" && selectedKind !== "tspan";
        const canEditText = selectedKind === "text";
        const isTextish = selectedKind === "text" || selectedKind === "tspan";
        // Slider-driven adjustments use previewMutation so we don't push a
        // history entry per pixel; the popover fires onCommit on slider
        // release which lands a single undo step for the whole drag.
        const adjust = {
          opacity: readOpacity(scene, selectedId),
          onOpacity: (v: number) =>
            previewMutation((s) => setOpacity(s, selectedId, v)),
          strokeWidth: hasStroke
            ? readStrokeWidth(scene, selectedId)
            : undefined,
          onStrokeWidth: hasStroke
            ? (v: number) =>
                previewMutation((s) => setStrokeWidth(s, selectedId, v))
            : undefined,
          cornerRadius:
            selectedKind === "rect"
              ? readCornerRadius(scene, selectedId)
              : undefined,
          onCornerRadius:
            selectedKind === "rect"
              ? (v: number) =>
                  previewMutation((s) => setCornerRadius(s, selectedId, v))
              : undefined,
        };
        const typography = isTextish
          ? {
              family: readFontFamily(scene, selectedId),
              size: readFontSize(scene, selectedId),
              weight: readFontWeight(scene, selectedId),
              italic: readFontStyle(scene, selectedId) === "italic",
              align: readTextAnchor(scene, selectedId),
              onFamily: (k: ReturnType<typeof readFontFamily>) =>
                commitMutation((s) => setFontFamily(s, selectedId, k)),
              onSize: (sz: number) =>
                commitMutation((s) => setFontSize(s, selectedId, sz)),
              onWeight: (w: number) =>
                commitMutation((s) => setFontWeight(s, selectedId, w)),
              onItalic: (it: boolean) =>
                commitMutation((s) => setFontStyle(s, selectedId, it)),
              onAlign: (a: "start" | "middle" | "end") =>
                commitMutation((s) => setTextAnchor(s, selectedId, a)),
            }
          : undefined;
        return (
          <FloatingToolbar
            bbox={bbox}
            containerRect={containerRect}
            kindLabel={selectedKind}
            fill={hasFill ? fill : null}
            stroke={hasStroke ? stroke : null}
            canFill={canFill}
            canStroke={canStroke}
            canEditText={canEditText}
            typography={typography}
            adjust={adjust}
            onChangeFill={(c) =>
              previewMutation((s) => setAttr(s, selectedId, "fill", c ?? "none"))
            }
            onChangeStroke={(c) =>
              previewMutation((s) => setAttr(s, selectedId, "stroke", c ?? "none"))
            }
            onCommit={commitCurrent}
            onEditText={() => openTextEditorForSelection()}
            onDelete={() => {
              commitMutation((s) => deleteElement(s, selectedId));
              setSelectedId(null);
            }}
          />
        );
      })()}

      {/* Bottom strip: history pill + save status */}
      <HistoryBar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        saving={saving}
        error={error}
      />
    </div>
  );
}

/**
 * Renders a <style> tag that draws a subtle dashed outline around the hovered
 * element. We avoid mutating the SVG itself — just use a CSS rule keyed off
 * data-edit-id so React state changes don't require re-rendering the SVG.
 */
function HoverStyle({
  hoveredId,
  selectedId,
}: {
  hoveredId: string | null;
  selectedId: string | null;
}) {
  if (!hoveredId || hoveredId === selectedId) return null;
  const safe = hoveredId.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <style>{`
      [${EDIT_ID_ATTR}="${safe}"] {
        outline: 1px dashed rgba(31,151,220,0.6);
        outline-offset: 2px;
      }
    `}</style>
  );
}

function HistoryBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saving,
  error,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <div className="inline-flex items-center rounded-full border border-paper-line bg-white p-0.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <HistoryIconButton
          title="Undo (⌘Z)"
          ariaLabel="Undo"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <UndoIcon />
        </HistoryIconButton>
        <span aria-hidden className="h-3.5 w-px bg-paper-line" />
        <HistoryIconButton
          title="Redo (⌘⇧Z)"
          ariaLabel="Redo"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <RedoIcon />
        </HistoryIconButton>
      </div>
      <SaveStatus saving={saving} error={error} dirty={canUndo} />
    </div>
  );
}

function HistoryIconButton({
  children,
  title,
  ariaLabel,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={
        "flex h-7 w-7 items-center justify-center rounded-full transition-colors " +
        (disabled
          ? "cursor-not-allowed text-ink-faint"
          : "text-ink-soft hover:bg-paper-soft hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function SaveStatus({
  saving,
  error,
  dirty,
}: {
  saving: boolean;
  error: string | null;
  dirty: boolean;
}) {
  if (error) {
    return (
      <span className="text-[11px] text-red-600" role="alert">
        {error}
      </span>
    );
  }
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        Saved
      </span>
    );
  }
  return <span aria-hidden className="text-[11px] text-transparent">·</span>;
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 5.5L3 8L6 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 8H10.25C11.7688 8 13 9.23122 13 10.75V10.75C13 12.2688 11.7688 13.5 10.25 13.5H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 5.5L13 8L10 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 8H5.75C4.23122 8 3 9.23122 3 10.75V10.75C3 12.2688 4.23122 13.5 5.75 13.5H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function cssSelectorEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

// ---------- Inline text input ----------
function InlineTextInput({
  textEdit,
  onCommit,
  onCancel,
}: {
  textEdit: {
    id: string;
    value: string;
    top: number;
    left: number;
    width: number;
    height: number;
  };
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(textEdit.value);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(v);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      style={{
        position: "absolute",
        top: textEdit.top,
        left: textEdit.left,
        width: textEdit.width,
        minHeight: textEdit.height,
        font: "14px ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
      className="z-50 rounded-sm border border-accent bg-white px-1 py-0.5 text-ink shadow-md focus:outline-none"
    />
  );
}

