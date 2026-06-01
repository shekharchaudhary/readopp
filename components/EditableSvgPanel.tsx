"use client";

import { useEffect, useRef, useState } from "react";
import {
  NodeEditPopover,
  PALETTES,
  type ColorTriple,
  type PaletteName,
} from "./NodeEditPopover";

interface Props {
  content: string;
  onSave: (next: string) => Promise<void>;
}

interface TextEditingState {
  /** The actual SVG text/tspan element being edited. */
  node: SVGElement;
  /** Position of an overlay input, in container-local coordinates. */
  rect: { top: number; left: number; width: number; height: number };
  /** Pixel font-size we measured from the live SVG; used to match the input's font. */
  fontPx: number;
  initialText: string;
  draft: string;
}

interface NodeSelection {
  rect: SVGRectElement;
  position: { top: number; left: number };
  palette: PaletteName | null;
}

/**
 * Inline-editable SVG panel.
 *
 * Phase 2a — every <text>/<tspan> with text becomes click-to-edit.
 * Phase 2b — every <rect> becomes click-to-select; a popover offers palette
 * swatches (recolor) and a delete control. Recoloring updates the rect's
 * fill/stroke and the fill of any text whose center falls inside the rect's
 * bbox. Deleting removes the rect, its associated texts, any enclosing <g>,
 * and any <path> whose start or end point lies inside the rect — so arrows
 * connecting to the deleted node don't dangle.
 *
 * Mutation strategy:
 * - Text edits mutate the live DOM in place (one element, simple rollback).
 * - Node edits work on a deep clone of the SVG, serialize, then save; the
 *   parent's content prop update re-mounts the SVG, so a failed save leaves
 *   the visible DOM untouched.
 */
export function EditableSvgPanel({ content, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<TextEditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NodeSelection | null>(null);

  useEffect(() => {
    const root = containerRef.current?.querySelector("svg");
    if (!root) return;
    const teardown: Array<() => void> = [];

    // ---- Text affordances (Phase 2a) ----
    collectEditable(root).forEach((el) => {
      el.style.cursor = "text";
      const onEnter = () => {
        el.style.outline = "1px dashed rgba(31,151,220,0.55)";
        el.style.outlineOffset = "2px";
      };
      const onLeave = () => {
        el.style.outline = "";
        el.style.outlineOffset = "";
      };
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        startEdit(el);
      };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("click", onClick);
      teardown.push(() => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("click", onClick);
      });
    });

    // ---- Rect affordances (Phase 2b) ----
    root.querySelectorAll("rect").forEach((rectEl) => {
      const rect = rectEl as SVGRectElement;
      // Skip rects that are clearly not nodes (no fill or fill="none").
      const fill = rect.getAttribute("fill") || "";
      if (!fill || fill.toLowerCase() === "none" || fill === "transparent") return;
      rect.style.cursor = "pointer";
      const onEnter = () => {
        if (selectedRectRef.current === rect) return;
        rect.dataset.readoppPrevStroke = rect.getAttribute("stroke") || "";
        rect.dataset.readoppPrevStrokeWidth =
          rect.getAttribute("stroke-width") || "";
        rect.style.outline = "2px solid rgba(31,151,220,0.55)";
        rect.style.outlineOffset = "2px";
      };
      const onLeave = () => {
        if (selectedRectRef.current === rect) return;
        rect.style.outline = "";
        rect.style.outlineOffset = "";
      };
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        selectNode(rect);
      };
      rect.addEventListener("mouseenter", onEnter);
      rect.addEventListener("mouseleave", onLeave);
      rect.addEventListener("click", onClick);
      teardown.push(() => {
        rect.removeEventListener("mouseenter", onEnter);
        rect.removeEventListener("mouseleave", onLeave);
        rect.removeEventListener("click", onClick);
      });
    });

    return () => teardown.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Track the currently selected rect in a ref so the per-rect mouseleave
  // listener (closed over above) can skip removing the selection outline.
  const selectedRectRef = useRef<SVGRectElement | null>(null);
  useEffect(() => {
    selectedRectRef.current = selected?.rect ?? null;
  }, [selected]);

  // ---- Text edit (Phase 2a) ----

  function startEdit(el: SVGElement) {
    const container = containerRef.current;
    if (!container) return;
    // Clear any node selection — text edit takes precedence.
    clearSelection();

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fontPx = parseFloat(cs.fontSize) || 14;

    el.style.visibility = "hidden";

    setEditing({
      node: el,
      rect: {
        top: eRect.top - cRect.top,
        left: eRect.left - cRect.left,
        width: Math.max(eRect.width, 80),
        height: Math.max(eRect.height, fontPx + 8),
      },
      fontPx,
      initialText: el.textContent ?? "",
      draft: el.textContent ?? "",
    });
    setError(null);
  }

  async function commitTextEdit() {
    if (!editing || saving) return;
    const next = editing.draft.trim();
    const original = editing.initialText.trim();
    if (next === original) {
      restoreVisibility(editing.node);
      setEditing(null);
      return;
    }
    if (next.length === 0) {
      setError("Text can't be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    editing.node.textContent = next;
    restoreVisibility(editing.node);

    const root = containerRef.current?.querySelector("svg");
    if (!root) {
      setSaving(false);
      return;
    }
    const serialized = root.outerHTML;
    try {
      await onSave(serialized);
      setEditing(null);
    } catch (e) {
      editing.node.textContent = editing.initialText;
      setError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function cancelTextEdit() {
    if (!editing) return;
    restoreVisibility(editing.node);
    setEditing(null);
    setError(null);
  }

  function onOverlayKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelTextEdit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitTextEdit();
    }
  }

  // ---- Node selection + recolor + delete (Phase 2b) ----

  function selectNode(rect: SVGRectElement) {
    const container = containerRef.current;
    if (!container) return;
    // Cancel any in-flight text edit.
    if (editing) cancelTextEdit();

    const prev = selectedRectRef.current;
    if (prev && prev !== rect) {
      prev.style.outline = "";
      prev.style.outlineOffset = "";
    }

    const cRect = container.getBoundingClientRect();
    const eRect = rect.getBoundingClientRect();
    // Persistent selection outline.
    rect.style.outline = "2px solid rgba(31,151,220,0.85)";
    rect.style.outlineOffset = "2px";

    const palette = identifyPalette(
      rect.getAttribute("fill") || "",
      rect.getAttribute("stroke") || ""
    );

    setSelected({
      rect,
      position: {
        top: eRect.bottom - cRect.top + 8,
        left: clamp(
          eRect.left - cRect.left,
          0,
          Math.max(cRect.width - 268, 0)
        ),
      },
      palette,
    });
  }

  function clearSelection() {
    const prev = selectedRectRef.current;
    if (prev) {
      prev.style.outline = "";
      prev.style.outlineOffset = "";
    }
    setSelected(null);
  }

  async function recolorSelected(triple: ColorTriple) {
    if (!selected) return;
    const root = containerRef.current?.querySelector("svg");
    if (!root) return;

    setSaving(true);
    setError(null);
    const tmp = `_readopp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    selected.rect.setAttribute("data-readopp-tmp", tmp);
    try {
      const clone = root.cloneNode(true) as SVGSVGElement;
      const cloneRect = clone.querySelector(
        `[data-readopp-tmp="${tmp}"]`
      ) as SVGRectElement | null;
      if (!cloneRect) throw new Error("clone lookup failed");
      cloneRect.removeAttribute("data-readopp-tmp");
      applyColorToNode(cloneRect, clone, triple);
      const serialized = clone.outerHTML;
      await onSave(serialized);
      // Parent will update content; React re-renders SVG fresh and selection
      // is cleared by the unmount.
      clearSelection();
    } catch (e) {
      setError((e as Error).message || "Recolor failed.");
    } finally {
      selected.rect.removeAttribute("data-readopp-tmp");
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    const root = containerRef.current?.querySelector("svg");
    if (!root) return;
    if (
      !window.confirm(
        "Delete this node, its labels, and any arrows that connect to it?"
      )
    )
      return;

    setSaving(true);
    setError(null);
    const tmp = `_readopp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    selected.rect.setAttribute("data-readopp-tmp", tmp);
    try {
      const clone = root.cloneNode(true) as SVGSVGElement;
      const cloneRect = clone.querySelector(
        `[data-readopp-tmp="${tmp}"]`
      ) as SVGRectElement | null;
      if (!cloneRect) throw new Error("clone lookup failed");
      cloneRect.removeAttribute("data-readopp-tmp");
      deleteNodeAndAssociated(cloneRect, clone, root);
      const serialized = clone.outerHTML;
      await onSave(serialized);
      clearSelection();
    } catch (e) {
      setError((e as Error).message || "Delete failed.");
    } finally {
      selected.rect.removeAttribute("data-readopp-tmp");
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="panel-svg-wrap"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {editing && (
        <textarea
          autoFocus
          rows={1}
          value={editing.draft}
          onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
          onBlur={commitTextEdit}
          onKeyDown={onOverlayKeyDown}
          disabled={saving}
          aria-label="Edit panel text"
          style={{
            position: "absolute",
            top: editing.rect.top - 4,
            left: editing.rect.left - 4,
            width: editing.rect.width + 8,
            minHeight: editing.rect.height + 8,
            fontSize: `${editing.fontPx}px`,
            lineHeight: 1.2,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
            padding: "2px 4px",
            margin: 0,
            background: "#ffffff",
            color: "#1a1a1a",
            border: "1px solid rgba(31,151,220,0.7)",
            outline: "2px solid rgba(31,151,220,0.2)",
            borderRadius: 3,
            resize: "none",
            zIndex: 10,
          }}
        />
      )}

      {selected && (
        <NodeEditPopover
          position={selected.position}
          currentPalette={selected.palette}
          busy={saving}
          onColorChange={recolorSelected}
          onDelete={deleteSelected}
          onClose={clearSelection}
        />
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: (editing?.rect.top ?? selected?.position.top ?? 0) + 4,
            left: editing?.rect.left ?? selected?.position.left ?? 0,
            zIndex: 30,
          }}
          className="rounded bg-white px-2 py-1 text-[11px] text-red-600 shadow"
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------

function collectEditable(root: SVGSVGElement): SVGElement[] {
  const out: SVGElement[] = [];
  root.querySelectorAll("tspan").forEach((t) => {
    if ((t.textContent ?? "").trim().length > 0) {
      out.push(t as unknown as SVGElement);
    }
  });
  root.querySelectorAll("text").forEach((t) => {
    const hasTspanChild = t.querySelector("tspan");
    if (!hasTspanChild && (t.textContent ?? "").trim().length > 0) {
      out.push(t as unknown as SVGElement);
    }
  });
  return out;
}

function restoreVisibility(el: SVGElement): void {
  el.style.visibility = "";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function normalizeHex(c: string): string {
  return (c || "").trim().toUpperCase();
}

function identifyPalette(fill: string, stroke: string): PaletteName | null {
  const f = normalizeHex(fill);
  const s = normalizeHex(stroke);
  for (const name of Object.keys(PALETTES) as PaletteName[]) {
    const p = PALETTES[name];
    if (normalizeHex(p.fill) === f) return name;
    if (normalizeHex(p.stroke) === s) return name;
  }
  return null;
}

function getRectBBox(rect: SVGRectElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: parseFloat(rect.getAttribute("x") || "0"),
    y: parseFloat(rect.getAttribute("y") || "0"),
    width: parseFloat(rect.getAttribute("width") || "0"),
    height: parseFloat(rect.getAttribute("height") || "0"),
  };
}

function pointInBBox(
  p: { x: number; y: number },
  bbox: { x: number; y: number; width: number; height: number },
  pad = 4
): boolean {
  return (
    p.x >= bbox.x - pad &&
    p.x <= bbox.x + bbox.width + pad &&
    p.y >= bbox.y - pad &&
    p.y <= bbox.y + bbox.height + pad
  );
}

function applyColorToNode(
  rect: SVGRectElement,
  root: SVGSVGElement,
  triple: ColorTriple
): void {
  rect.setAttribute("fill", triple.fill);
  rect.setAttribute("stroke", triple.stroke);

  // Recolor any text whose anchor falls inside the rect's bbox.
  const bbox = getRectBBox(rect);
  const textNodes = root.querySelectorAll("text, tspan");
  textNodes.forEach((t) => {
    const cx = parseFloat(t.getAttribute("x") || "NaN");
    const cy = parseFloat(t.getAttribute("y") || "NaN");
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      if (pointInBBox({ x: cx, y: cy }, bbox)) {
        t.setAttribute("fill", triple.text);
      }
    }
  });
}

/**
 * Remove the node rect, any text whose anchor falls inside it, any enclosing
 * single-child <g> wrapper, and any <path> whose start or end point lands
 * inside the rect's bbox (so arrows don't dangle).
 *
 * `liveRoot` is the live in-DOM SVG — used to resolve path endpoints via
 * getPointAtLength, which doesn't work on detached clones in some browsers.
 * We map elements between live and clone by index.
 */
function deleteNodeAndAssociated(
  rectInClone: SVGRectElement,
  clone: SVGSVGElement,
  liveRoot: SVGSVGElement
): void {
  const bbox = getRectBBox(rectInClone);

  // Build an index → element map for paths on both clone and live root so we
  // can read endpoints from the live element (only those have layout).
  const clonePaths = Array.from(clone.querySelectorAll("path"));
  const livePaths = Array.from(liveRoot.querySelectorAll("path"));

  const toRemove = new Set<Element>();
  toRemove.add(rectInClone);

  // Texts inside the rect.
  clone.querySelectorAll("text, tspan").forEach((t) => {
    const cx = parseFloat(t.getAttribute("x") || "NaN");
    const cy = parseFloat(t.getAttribute("y") || "NaN");
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      if (pointInBBox({ x: cx, y: cy }, bbox)) {
        toRemove.add(t);
      }
    }
  });

  // Paths connecting to the rect.
  for (let i = 0; i < clonePaths.length; i++) {
    const live = livePaths[i];
    if (!live) continue;
    try {
      const len = live.getTotalLength();
      if (!Number.isFinite(len) || len === 0) continue;
      const a = live.getPointAtLength(0);
      const b = live.getPointAtLength(len);
      if (pointInBBox({ x: a.x, y: a.y }, bbox) || pointInBBox({ x: b.x, y: b.y }, bbox)) {
        toRemove.add(clonePaths[i]);
      }
    } catch {
      // ignore
    }
  }

  // If the rect's parent is a <g> that contains only this rect (plus the
  // texts we already marked), prefer removing the whole group so we don't
  // leave an empty wrapper.
  const parent = rectInClone.parentElement;
  if (
    parent &&
    parent.tagName.toLowerCase() === "g" &&
    (parent as Element) !== (clone as Element)
  ) {
    const survivors = Array.from(parent.children).filter(
      (c) => !toRemove.has(c)
    );
    if (survivors.length === 0) {
      toRemove.add(parent);
    }
  }

  toRemove.forEach((el) => el.remove());
}
