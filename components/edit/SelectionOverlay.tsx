"use client";

/**
 * Selection visuals drawn in PIXEL space (CSS positioning) — not SVG viewBox
 * space. Reading the selected element's getBoundingClientRect and computing
 * an offset against the container avoids any viewBox / preserveAspectRatio
 * mismatch that would shift the ring relative to the element.
 *
 * Pixel-space ring + 4 short accent capsule bars on the edge midpoints.
 */

export interface Bbox {
  /** Pixel offset from the top-left of the overlay container. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HandleKey = "n" | "e" | "s" | "w";

const HANDLE_KEYS: HandleKey[] = ["n", "e", "s", "w"];

const ACCENT = "#1F97DC";

// Handle visual size in PIXELS — consistent regardless of SVG scale.
const BAR_LEN = 18;
const BAR_THICK = 4;

interface Props {
  /** Pixel-space bbox relative to the overlay's positioned ancestor. */
  bbox: Bbox;
  /** True if this element supports resize (rect). */
  resizable: boolean;
  onHandlePointerDown?: (handle: HandleKey, e: React.PointerEvent) => void;
}

export function SelectionOverlay({
  bbox,
  resizable,
  onHandlePointerDown,
}: Props) {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  const HANDLE_POS: Record<
    HandleKey,
    { x: number; y: number; cursor: string; orient: "h" | "v" }
  > = {
    n: { x: cx, y: bbox.y, cursor: "ns-resize", orient: "h" },
    e: { x: bbox.x + bbox.width, y: cy, cursor: "ew-resize", orient: "v" },
    s: { x: cx, y: bbox.y + bbox.height, cursor: "ns-resize", orient: "h" },
    w: { x: bbox.x, y: cy, cursor: "ew-resize", orient: "v" },
  };

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Selection ring */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: bbox.y,
          left: bbox.x,
          width: bbox.width,
          height: bbox.height,
          border: `1px solid ${ACCENT}`,
          boxSizing: "border-box",
        }}
      />
      {/* Edge capsule handles */}
      {resizable &&
        HANDLE_KEYS.map((key) => {
          const pos = HANDLE_POS[key];
          const isHoriz = pos.orient === "h";
          const w = isHoriz ? BAR_LEN : BAR_THICK;
          const h = isHoriz ? BAR_THICK : BAR_LEN;
          return (
            <div
              key={key}
              className="absolute pointer-events-auto"
              style={{
                top: pos.y - h / 2,
                left: pos.x - w / 2,
                width: w,
                height: h,
                background: ACCENT,
                borderRadius: Math.min(w, h),
                cursor: pos.cursor,
              }}
              onPointerDown={(e) => onHandlePointerDown?.(key, e)}
            />
          );
        })}
    </div>
  );
}

/**
 * Map a pointer event's clientX/clientY to SVG user-space coordinates, using
 * the bounding rect of the containing element and the panel's viewBox.
 */
export function clientToSvg(
  e: { clientX: number; clientY: number },
  containerRect: DOMRect,
  viewBox: { width: number; height: number }
): { x: number; y: number } {
  const scaleX = viewBox.width / containerRect.width;
  const scaleY = viewBox.height / containerRect.height;
  return {
    x: (e.clientX - containerRect.left) * scaleX,
    y: (e.clientY - containerRect.top) * scaleY,
  };
}
