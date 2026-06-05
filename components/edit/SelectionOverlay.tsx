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
export type EndpointKey = "1" | "2";

const HANDLE_KEYS: HandleKey[] = ["n", "e", "s", "w"];

const ACCENT = "#1F97DC";

// Handle visual size in PIXELS — consistent regardless of SVG scale.
const BAR_LEN = 18;
const BAR_THICK = 4;
const ENDPOINT_R = 5;

interface Props {
  /** Pixel-space bbox relative to the overlay's positioned ancestor. */
  bbox: Bbox;
  /** True if this element supports rect-style edge resize. */
  resizable: boolean;
  onHandlePointerDown?: (handle: HandleKey, e: React.PointerEvent) => void;
  /**
   * For <line> elements, pass the two endpoints in pixel space relative to the
   * overlay's positioned ancestor. When present, edge handles are hidden in
   * favor of two endpoint dots — each draggable independently.
   */
  lineEndpoints?: { p1: { x: number; y: number }; p2: { x: number; y: number } };
  onEndpointPointerDown?: (
    end: EndpointKey,
    e: React.PointerEvent
  ) => void;
}

export function SelectionOverlay({
  bbox,
  resizable,
  onHandlePointerDown,
  lineEndpoints,
  onEndpointPointerDown,
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
      {/* Edge capsule handles (rect / standard resize) — hidden when the
          selection is a line, since line endpoints are far more useful. */}
      {resizable &&
        !lineEndpoints &&
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
      {/* Line endpoint handles: a white dot with an accent ring at each end. */}
      {lineEndpoints &&
        (["1", "2"] as EndpointKey[]).map((end) => {
          const p = end === "1" ? lineEndpoints.p1 : lineEndpoints.p2;
          return (
            <div
              key={`ep${end}`}
              className="absolute pointer-events-auto"
              style={{
                top: p.y - ENDPOINT_R,
                left: p.x - ENDPOINT_R,
                width: ENDPOINT_R * 2,
                height: ENDPOINT_R * 2,
                background: "#ffffff",
                border: `2px solid ${ACCENT}`,
                borderRadius: "999px",
                cursor: "grab",
                boxSizing: "border-box",
              }}
              onPointerDown={(e) => onEndpointPointerDown?.(end, e)}
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
