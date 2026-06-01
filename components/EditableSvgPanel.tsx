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
  // True for one click event after a drag, so the subsequent click on the
  // dragged rect doesn't also open the selection popover.
  const justDraggedRef = useRef(false);
  // Mirror of `editing` for read inside per-rect listeners (stable closure).
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = !!editing;
  }, [editing]);

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

    // ---- Drag state (Phase 2c) — one in-flight session at a time ----
    // Held in closure scope (not React state) so per-frame mousemove updates
    // don't trigger re-renders. We mutate live DOM attributes directly and
    // serialize once on mouseup.
    interface DragSession {
      rect: SVGRectElement;
      origRectX: number;
      origRectY: number;
      origBBox: { x: number; y: number; width: number; height: number };
      texts: Array<{ el: Element; origX: number; origY: number }>;
      paths: Array<{
        el: SVGPathElement;
        which: "start" | "end" | "both";
        origStart: { x: number; y: number };
        origEnd: { x: number; y: number };
        origD: string;
      }>;
      origin: { x: number; y: number };
      moved: boolean;
    }
    let dragSession: DragSession | null = null;

    const onDragMove = (e: MouseEvent) => {
      const s = dragSession;
      if (!s) return;
      const cur = clientToSvg(root, e.clientX, e.clientY);
      const dx = cur.x - s.origin.x;
      const dy = cur.y - s.origin.y;
      if (!s.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        s.moved = true;
        s.rect.style.cursor = "grabbing";
        s.rect.style.outline = "2px solid rgba(31,151,220,0.85)";
        s.rect.style.outlineOffset = "2px";
      }
      if (!s.moved) return;
      s.rect.setAttribute("x", fmt(s.origRectX + dx));
      s.rect.setAttribute("y", fmt(s.origRectY + dy));
      s.texts.forEach(({ el, origX, origY }) => {
        el.setAttribute("x", fmt(origX + dx));
        el.setAttribute("y", fmt(origY + dy));
      });
      s.paths.forEach((p) => {
        let d = p.origD;
        if (p.which === "start" || p.which === "both") {
          d = rewritePathStart(d, p.origStart.x + dx, p.origStart.y + dy);
        }
        if (p.which === "end" || p.which === "both") {
          d = rewritePathEnd(d, p.origEnd.x + dx, p.origEnd.y + dy);
        }
        p.el.setAttribute("d", d);
      });
    };

    const onDragEnd = async () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      const s = dragSession;
      dragSession = null;
      if (!s) return;
      if (!s.moved) return; // a click, not a drag — let click fire normally

      justDraggedRef.current = true;
      setSaving(true);
      setError(null);
      try {
        const serialized = root.outerHTML;
        await onSave(serialized);
      } catch (err) {
        // Revert live DOM
        s.rect.setAttribute("x", fmt(s.origRectX));
        s.rect.setAttribute("y", fmt(s.origRectY));
        s.texts.forEach(({ el, origX, origY }) => {
          el.setAttribute("x", fmt(origX));
          el.setAttribute("y", fmt(origY));
        });
        s.paths.forEach((p) => p.el.setAttribute("d", p.origD));
        setError((err as Error).message || "Move failed.");
      } finally {
        s.rect.style.cursor = "";
        s.rect.style.outline = "";
        s.rect.style.outlineOffset = "";
        setSaving(false);
      }
    };

    const startDrag = (rect: SVGRectElement, e: MouseEvent) => {
      if (editingRef.current) return; // don't drag while a text edit is open
      const origBBox = getRectBBox(rect);
      const origRectX = parseFloat(rect.getAttribute("x") || "0");
      const origRectY = parseFloat(rect.getAttribute("y") || "0");

      const texts: Array<{ el: Element; origX: number; origY: number }> = [];
      root.querySelectorAll("text, tspan").forEach((t) => {
        const cx = parseFloat(t.getAttribute("x") || "NaN");
        const cy = parseFloat(t.getAttribute("y") || "NaN");
        if (
          Number.isFinite(cx) &&
          Number.isFinite(cy) &&
          pointInBBox({ x: cx, y: cy }, origBBox)
        ) {
          texts.push({ el: t, origX: cx, origY: cy });
        }
      });

      const paths: DragSession["paths"] = [];
      root.querySelectorAll("path").forEach((p) => {
        const path = p as SVGPathElement;
        const d = path.getAttribute("d") || "";
        if (!pathIsSafeForRewrite(d)) return;
        try {
          const len = path.getTotalLength();
          if (!Number.isFinite(len) || len === 0) return;
          const a = path.getPointAtLength(0);
          const b = path.getPointAtLength(len);
          const startIn = pointInBBox({ x: a.x, y: a.y }, origBBox);
          const endIn = pointInBBox({ x: b.x, y: b.y }, origBBox);
          if (!startIn && !endIn) return;
          paths.push({
            el: path,
            which: startIn && endIn ? "both" : startIn ? "start" : "end",
            origStart: { x: a.x, y: a.y },
            origEnd: { x: b.x, y: b.y },
            origD: d,
          });
        } catch {
          // ignore
        }
      });

      dragSession = {
        rect,
        origRectX,
        origRectY,
        origBBox,
        texts,
        paths,
        origin: clientToSvg(root, e.clientX, e.clientY),
        moved: false,
      };
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragEnd);
    };

    // ---- Rect affordances (Phase 2b + 2c) ----
    root.querySelectorAll("rect").forEach((rectEl) => {
      const rect = rectEl as SVGRectElement;
      // Skip rects that are clearly not nodes (no fill or fill="none").
      const fill = rect.getAttribute("fill") || "";
      if (!fill || fill.toLowerCase() === "none" || fill === "transparent") return;
      rect.style.cursor = "grab";
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
        if (dragSession && dragSession.rect === rect) return;
        rect.style.outline = "";
        rect.style.outlineOffset = "";
      };
      const onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(rect, e);
      };
      const onClick = (e: MouseEvent) => {
        if (justDraggedRef.current) {
          justDraggedRef.current = false;
          return;
        }
        e.stopPropagation();
        selectNode(rect);
      };
      rect.addEventListener("mouseenter", onEnter);
      rect.addEventListener("mouseleave", onLeave);
      rect.addEventListener("mousedown", onMouseDown);
      rect.addEventListener("click", onClick);
      teardown.push(() => {
        rect.removeEventListener("mouseenter", onEnter);
        rect.removeEventListener("mouseleave", onLeave);
        rect.removeEventListener("mousedown", onMouseDown);
        rect.removeEventListener("click", onClick);
      });
    });

    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      teardown.forEach((fn) => fn());
    };
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

// ---------- Phase 2c drag helpers ----------

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Whether we can safely rewrite the first/last numeric XY pair of this path's
 * `d` attribute as an endpoint. We reject relative commands (lowercase) and
 * single-coord H/V commands, which would invalidate naive endpoint logic.
 * Skipped paths simply don't follow the dragged node.
 */
function pathIsSafeForRewrite(d: string): boolean {
  if (/[a-y]/.test(d)) return false;
  if (/[HV]/.test(d)) return false;
  return true;
}

const NUM_PATTERN = /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;

function findAllNumberMatches(
  d: string
): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  const re = new RegExp(NUM_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function rewritePathStart(d: string, x: number, y: number): string {
  const nums = findAllNumberMatches(d);
  if (nums.length < 2) return d;
  const [a, b] = nums;
  return (
    d.slice(0, a.start) +
    fmt(x) +
    d.slice(a.end, b.start) +
    fmt(y) +
    d.slice(b.end)
  );
}

function rewritePathEnd(d: string, x: number, y: number): string {
  const nums = findAllNumberMatches(d);
  if (nums.length < 2) return d;
  const a = nums[nums.length - 2];
  const b = nums[nums.length - 1];
  return (
    d.slice(0, a.start) +
    fmt(x) +
    d.slice(a.end, b.start) +
    fmt(y) +
    d.slice(b.end)
  );
}
