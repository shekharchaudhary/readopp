"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
  onSave: (next: string) => Promise<void>;
}

interface EditingState {
  /** The actual SVG text/tspan element being edited. */
  node: SVGElement;
  /** Position of an overlay input, in container-local coordinates. */
  rect: { top: number; left: number; width: number; height: number };
  /** Pixel font-size we measured from the live SVG; used to match the input's font. */
  fontPx: number;
  initialText: string;
  draft: string;
}

/**
 * Inline-editable SVG panel. Every <text> or <tspan> with non-empty text content
 * becomes click-to-edit. On commit we mutate the DOM and serialize the SVG back
 * out, so the saved content is a deterministic round-trip of what the user sees.
 *
 * Multi-tspan text elements (e.g. node label + subtitle, or multi-line labels)
 * expose each tspan as a separately-editable string. Single-text-node elements
 * are editable as one string.
 */
export function EditableSvgPanel({ content, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attach hover + click affordances to every editable text node whenever
  // the SVG content (re-)mounts.
  useEffect(() => {
    const root = containerRef.current?.querySelector("svg");
    if (!root) return;

    const nodes = collectEditable(root);
    const teardown: Array<() => void> = [];

    nodes.forEach((el) => {
      el.style.cursor = "text";
      // A subtle hover ring on the text bounding box — implemented as a
      // shifting outline color via mouseenter/leave so we don't have to
      // inject CSS classes into the model-rendered SVG.
      const onEnter = () => {
        el.dataset.readoppHover = "1";
        el.style.outline = "1px dashed rgba(15,110,86,0.55)";
        el.style.outlineOffset = "2px";
      };
      const onLeave = () => {
        delete el.dataset.readoppHover;
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

    return () => {
      teardown.forEach((fn) => fn());
    };
    // We deliberately re-run when content changes — the SVG is re-mounted
    // via dangerouslySetInnerHTML and the previous element refs are gone.
  }, [content]);

  function startEdit(el: SVGElement) {
    const container = containerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fontPx = parseFloat(cs.fontSize) || 14;

    // Hide the SVG text while editing so the overlay input doesn't double up.
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

  async function commit() {
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

    // Mutate the text content in the live SVG.
    editing.node.textContent = next;
    restoreVisibility(editing.node);

    // Serialize the (mutated) SVG back to a string for persistence.
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
      // Roll back the in-DOM mutation so the user can re-try without losing
      // their original. The parent didn't accept the change — we shouldn't
      // pretend we did.
      editing.node.textContent = editing.initialText;
      setError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (!editing) return;
    restoreVisibility(editing.node);
    setEditing(null);
    setError(null);
  }

  function onOverlayKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="panel-svg-wrap"
        // The SVG comes from the model + our validators. We're rendering it
        // inline so text is real vector text (the whole point of this app).
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {editing && (
        <textarea
          autoFocus
          rows={1}
          value={editing.draft}
          onChange={(e) =>
            setEditing({ ...editing, draft: e.target.value })
          }
          onBlur={commit}
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
            border: "1px solid rgba(15,110,86,0.7)",
            outline: "2px solid rgba(15,110,86,0.2)",
            outlineOffset: "0px",
            borderRadius: 3,
            resize: "none",
            zIndex: 10,
          }}
        />
      )}
      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: (editing?.rect.top ?? 0) + (editing?.rect.height ?? 0) + 4,
            left: editing?.rect.left ?? 0,
            zIndex: 11,
          }}
          className="rounded bg-white px-2 py-1 text-[11px] text-red-600 shadow"
        >
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Walk the SVG and return every <tspan> with text, plus every <text> with no
 * tspan children and non-empty text. This treats multi-tspan text elements as
 * a list of separately-editable strings, which matches how the model uses
 * tspans (one for label, one for subtitle, etc.).
 */
function collectEditable(root: SVGSVGElement): SVGElement[] {
  const out: SVGElement[] = [];
  const tspans = root.querySelectorAll("tspan");
  tspans.forEach((t) => {
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
