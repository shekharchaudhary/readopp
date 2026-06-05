"use client";

import { useEffect, useRef, useState } from "react";
import type { FontFamilyKey } from "@/lib/edit/sceneGraph";
import { AdjustPopover } from "./AdjustPopover";
import { ColorPicker } from "./ColorPicker";
import type { Bbox } from "./SelectionOverlay";
import { TypographyPopover } from "./TypographyPopover";

/**
 * Pill-shaped toolbar that floats above the selected element's bbox.
 *
 * Buttons:
 *   - Fill: swatch dot → click opens a tethered ColorPicker popover
 *   - Stroke: outlined swatch dot → opens picker
 *   - Edit text (text-kind only): opens inline text input via callback
 *   - Delete
 *
 * The toolbar positions itself in container-pixel space; the parent supplies
 * the selected element's bbox in SVG user space along with the container's
 * pixel rect so we can convert.
 */

export interface ToolbarProps {
  /** Pixel-space bbox of the selected element (relative to the toolbar's positioned ancestor). */
  bbox: Bbox;
  /** Pixel rect of the panel container — used for horizontal clamping. */
  containerRect: DOMRect | null;

  fill: string | null;
  stroke: string | null;
  canFill: boolean;
  canStroke: boolean;
  canEditText: boolean;
  /** Typography panel only shown when the selected element is text/tspan. */
  typography?: {
    family: FontFamilyKey;
    size: number;
    weight: number;
    italic: boolean;
    align: "start" | "middle" | "end";
    onFamily: (k: FontFamilyKey) => void;
    onSize: (size: number) => void;
    onWeight: (weight: number) => void;
    onItalic: (italic: boolean) => void;
    onAlign: (a: "start" | "middle" | "end") => void;
  };
  /** Fine style adjustments (opacity always, stroke-width if hasStroke, corner radius if rect). */
  adjust: {
    opacity: number;
    onOpacity: (v: number) => void;
    strokeWidth?: number;
    onStrokeWidth?: (v: number) => void;
    cornerRadius?: number;
    onCornerRadius?: (v: number) => void;
  };

  onChangeFill: (color: string | null) => void;
  onChangeStroke: (color: string | null) => void;
  /** Fired when a streaming interaction (slider drag) ends. Used to push the
   *  preview chain to history as a single undo entry. */
  onCommit?: () => void;
  onEditText: () => void;
  onDelete: () => void;
  /** What's selected — shown as a small label at the left of the toolbar so
   *  the user always knows what they're editing. */
  kindLabel?: string;
}

type Popover = "fill" | "stroke" | "type" | "adjust" | null;

export function FloatingToolbar(props: ToolbarProps) {
  const {
    bbox,
    containerRect,
    fill,
    stroke,
    canFill,
    canStroke,
    canEditText,
    typography,
    adjust,
    onChangeFill,
    onChangeStroke,
    onCommit,
    onEditText,
    onDelete,
    kindLabel,
  } = props;

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [popover, setPopover] = useState<Popover>(null);

  // Close popover when clicking outside the toolbar OR pressing Escape.
  useEffect(() => {
    if (!popover) return;
    function onDown(e: MouseEvent) {
      const t = toolbarRef.current;
      if (t && !t.contains(e.target as Node)) setPopover(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopover(null);
    }
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [popover]);

  if (!containerRect) return null;

  // bbox is already in PIXEL space relative to the panel-svg-wrap, which is
  // also the toolbar's positioned ancestor → no viewBox conversion needed.
  const TOOLBAR_W = 260;
  const ideal = bbox.x + bbox.width / 2 - TOOLBAR_W / 2;
  const minLeft = 4;
  const maxLeft = containerRect.width - TOOLBAR_W - 4;
  const left = Math.max(minLeft, Math.min(maxLeft, ideal));
  // If the element is near the top, flip the toolbar below the bbox.
  const flipBelow = bbox.y < 44;
  const top = flipBelow ? bbox.y + bbox.height + 12 : bbox.y - 44;
  // Popover opens AWAY from the element so it never covers what you're
  // editing: toolbar above element → popover above toolbar; toolbar below
  // element → popover below toolbar.
  const popoverPosition = flipBelow
    ? "top-full mt-2"
    : "bottom-full mb-2";

  const showFill = canFill;
  const showStroke = canStroke;

  return (
    <div
      ref={toolbarRef}
      className="absolute z-30 select-none"
      style={{ top, left, width: TOOLBAR_W }}
      // Prevent the panel-level click handler from deselecting when the user
      // interacts with the toolbar.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 rounded-full border border-ink/70 bg-[#1f1f1d] px-1.5 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.25)]">
        {kindLabel && (
          <>
            <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-paper-line/80">
              {kindLabel}
            </span>
            <span aria-hidden className="h-4 w-px bg-white/15" />
          </>
        )}
        {showFill && (
          <ToolbarSwatchButton
            label="Fill"
            color={fill}
            active={popover === "fill"}
            onClick={() => setPopover(popover === "fill" ? null : "fill")}
          />
        )}
        {showStroke && (
          <ToolbarSwatchButton
            label="Stroke"
            color={stroke}
            outline
            active={popover === "stroke"}
            onClick={() =>
              setPopover(popover === "stroke" ? null : "stroke")
            }
          />
        )}
        {typography && (
          <ToolbarTypeButton
            active={popover === "type"}
            onClick={() => setPopover(popover === "type" ? null : "type")}
          />
        )}
        {canEditText && (
          <ToolbarIconButton
            label="Edit text"
            onClick={onEditText}
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M3 13.5V11L11 3L13 5L5 13H3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        )}
        <ToolbarAdjustButton
          active={popover === "adjust"}
          onClick={() => setPopover(popover === "adjust" ? null : "adjust")}
        />
        <div className="mx-1 h-4 w-px bg-white/15" />
        <ToolbarIconButton
          label="Delete"
          danger
          onClick={onDelete}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 4H13.5M6 4V2.5H10V4M4.5 4L5 13C5 13.5 5.5 14 6 14H10C10.5 14 11 13.5 11 13L11.5 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>

      {/* Popovers — open away from the element so editing stays visible */}
      {popover === "fill" && (
        <PopoverShell
          position={popoverPosition}
          onClose={() => setPopover(null)}
        >
          <ColorPicker
            label="Fill"
            value={fill}
            allowNone
            onChange={onChangeFill}
            onCommit={onCommit}
          />
        </PopoverShell>
      )}
      {popover === "stroke" && (
        <PopoverShell
          position={popoverPosition}
          onClose={() => setPopover(null)}
        >
          <ColorPicker
            label="Stroke"
            value={stroke}
            allowNone
            onChange={onChangeStroke}
            onCommit={onCommit}
          />
        </PopoverShell>
      )}
      {popover === "type" && typography && (
        <PopoverShell
          position={popoverPosition}
          onClose={() => setPopover(null)}
        >
          <TypographyPopover
            family={typography.family}
            size={typography.size}
            weight={typography.weight}
            italic={typography.italic}
            align={typography.align}
            onFamily={typography.onFamily}
            onSize={typography.onSize}
            onWeight={typography.onWeight}
            onItalic={typography.onItalic}
            onAlign={typography.onAlign}
          />
        </PopoverShell>
      )}
      {popover === "adjust" && (
        <PopoverShell
          position={popoverPosition}
          onClose={() => setPopover(null)}
        >
          <AdjustPopover
            opacity={adjust.opacity}
            onOpacity={adjust.onOpacity}
            strokeWidth={adjust.strokeWidth}
            onStrokeWidth={adjust.onStrokeWidth}
            cornerRadius={adjust.cornerRadius}
            onCornerRadius={adjust.onCornerRadius}
            onCommit={onCommit}
          />
        </PopoverShell>
      )}
    </div>
  );
}

function ToolbarAdjustButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Adjust"
      aria-label="Adjust"
      className={
        "flex h-7 w-7 items-center justify-center rounded-full text-paper transition-colors " +
        (active ? "bg-white/20" : "hover:bg-white/10")
      }
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
        <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
      </svg>
    </button>
  );
}

/**
 * Wraps a popover with a position class and a tiny close (×) button.
 * Stays open across many edits — user explicitly closes via the X, Escape,
 * the toolbar button toggle, or by clicking outside the toolbar.
 */
function PopoverShell({
  position,
  onClose,
  children,
}: {
  position: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`absolute left-0 ${position}`}>
      <div className="relative">
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-paper-line/70 transition-colors hover:bg-white/15 hover:text-paper"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M2 2 L8 8 M8 2 L2 8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToolbarTypeButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Typography"
      aria-label="Typography"
      className={
        "flex h-7 w-8 items-center justify-center rounded-full text-paper transition-colors " +
        (active ? "bg-white/20" : "hover:bg-white/10")
      }
    >
      <span className="text-[12px] font-medium leading-none">
        <span className="text-base">A</span>
        <span className="text-[10px] opacity-70">a</span>
      </span>
    </button>
  );
}

function ToolbarSwatchButton({
  color,
  label,
  active,
  outline,
  onClick,
}: {
  color: string | null;
  label: string;
  active: boolean;
  outline?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${color ?? "none"}`}
      aria-label={label}
      className={
        "flex h-7 w-7 items-center justify-center rounded-full transition-colors " +
        (active ? "bg-white/20" : "hover:bg-white/10")
      }
    >
      <span
        className="block h-4 w-4 rounded-full border border-white/40"
        style={
          outline
            ? {
                background: "transparent",
                borderColor: color ?? "rgba(255,255,255,0.4)",
                borderWidth: 2,
              }
            : { background: color ?? "transparent" }
        }
      />
    </button>
  );
}

function ToolbarIconButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "flex h-7 w-7 items-center justify-center rounded-full text-paper transition-colors " +
        (danger ? "hover:bg-red-500/20" : "hover:bg-white/10")
      }
    >
      {icon}
    </button>
  );
}
