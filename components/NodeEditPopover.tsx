"use client";

import { useEffect, useRef, useState } from "react";

export interface ColorTriple {
  fill: string;
  stroke: string;
  text: string;
}

export const PALETTES = {
  blue: { fill: "#E6F1FB", stroke: "#185FA5", text: "#0C447C" },
  teal: { fill: "#E1F5EE", stroke: "#0F6E56", text: "#085041" },
  amber: { fill: "#FAEEDA", stroke: "#854F0B", text: "#633806" },
  purple: { fill: "#EEEDFE", stroke: "#534AB7", text: "#3C3489" },
  gray: { fill: "#F1EFE8", stroke: "#5F5E5A", text: "#2C2C2A" },
} as const satisfies Record<string, ColorTriple>;

export type PaletteName = keyof typeof PALETTES;

const PALETTE_LIST: PaletteName[] = ["blue", "teal", "amber", "purple", "gray"];

// ============================================================================
// Shared color picker
// ============================================================================

interface ColorPanelProps {
  /** When a node is selected and its colors match a preset, name it. */
  currentPalette: PaletteName | null;
  busy?: boolean;
  onChange: (triple: ColorTriple) => void;
}

/**
 * Reusable color-picking UI: preset swatches, custom picker, hex display,
 * brightness slider. Used by both per-node and whole-panel popovers.
 */
function ColorPanel({ currentPalette, busy, onChange }: ColorPanelProps) {
  // baseHex is whatever the user last *picked* (preset stroke, picker, or hex
  // input). brightness then shifts that base along the lightness axis.
  const [baseHex, setBaseHex] = useState<string>(() =>
    currentPalette ? PALETTES[currentPalette].stroke : "#1F97DC"
  );
  const [brightness, setBrightness] = useState<number>(50);
  const [hexInput, setHexInput] = useState<string>("");

  // Re-sync when the parent surfaces a different identified palette.
  useEffect(() => {
    if (currentPalette) {
      setBaseHex(PALETTES[currentPalette].stroke);
      setBrightness(50);
    }
  }, [currentPalette]);

  const effectiveHex = shiftLightness(baseHex, (brightness - 50) * 0.6);
  const displayHex = (hexInput || effectiveHex).toUpperCase();

  function pickPreset(name: PaletteName) {
    const p = PALETTES[name];
    setBaseHex(p.stroke);
    setBrightness(50);
    setHexInput("");
    onChange(p);
  }

  function pickCustom(hex: string) {
    setBaseHex(hex);
    setBrightness(50);
    setHexInput("");
    onChange(deriveTriple(hex));
  }

  function slideBrightness(v: number) {
    setBrightness(v);
    setHexInput("");
    onChange(deriveTriple(shiftLightness(baseHex, (v - 50) * 0.6)));
  }

  function onHexTyped(raw: string) {
    setHexInput(raw);
    const norm = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(norm)) pickCustom(norm);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="px-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Presets
        </div>
        <div className="flex items-center gap-2 px-1">
          {PALETTE_LIST.map((name) => {
            const p = PALETTES[name];
            const selected = currentPalette === name;
            return (
              <button
                key={name}
                type="button"
                disabled={busy}
                aria-label={`Recolor to ${name}`}
                aria-pressed={selected}
                title={name}
                onClick={() => pickPreset(name)}
                style={{ background: p.stroke }}
                className={
                  "h-8 w-8 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)] transition-transform disabled:cursor-not-allowed " +
                  (selected
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-white"
                    : "hover:scale-110")
                }
              />
            );
          })}

          <label
            className={
              "relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed transition-colors " +
              (busy
                ? "cursor-not-allowed border-paper-line text-ink-faint"
                : "border-paper-line text-ink-muted hover:border-accent hover:text-accent")
            }
            title="Custom color"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            <input
              type="color"
              aria-label="Custom color"
              disabled={busy}
              value={effectiveHex}
              onChange={(e) => pickCustom(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <div
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-md border border-paper-line"
          style={{ background: effectiveHex }}
        />
        <input
          type="text"
          value={displayHex}
          onChange={(e) => onHexTyped(e.target.value)}
          onBlur={() => setHexInput("")}
          disabled={busy}
          aria-label="Hex color"
          spellCheck={false}
          maxLength={7}
          className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 font-mono text-xs uppercase tracking-tight text-ink focus:border-accent focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      <div className="px-1">
        <div className="flex items-center justify-between pb-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Brightness
          </span>
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {brightness}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={brightness}
          disabled={busy}
          onChange={(e) => slideBrightness(parseInt(e.target.value, 10))}
          className="w-full accent-accent disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Per-node popover (Phase 2b)
// ============================================================================

interface NodePopoverProps {
  position: { top: number; left: number };
  currentPalette: PaletteName | null;
  busy?: boolean;
  onColorChange: (triple: ColorTriple) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeEditPopover({
  position,
  currentPalette,
  busy,
  onColorChange,
  onDelete,
  onClose,
}: NodePopoverProps) {
  const ref = useDismissable(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Node options"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 20,
      }}
      className="flex w-[300px] flex-col gap-3 rounded-lg border border-paper-line bg-surface p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Node colors
        </span>
        {busy && (
          <span className="font-mono text-[10px] text-ink-faint">saving…</span>
        )}
      </div>

      <ColorPanel
        currentPalette={currentPalette}
        busy={busy}
        onChange={onColorChange}
      />

      <div className="my-1 h-px bg-paper-line" />
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          Delete node
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Whole-panel theme popover
// ============================================================================

interface ThemePopoverProps {
  /** Position within the panel's relative-positioned wrapper. */
  position?: { top?: number; right?: number; left?: number };
  busy?: boolean;
  onColorChange: (triple: ColorTriple) => void;
  onClose: () => void;
}

export function PanelThemePopover({
  position,
  busy,
  onColorChange,
  onClose,
}: ThemePopoverProps) {
  const ref = useDismissable(onClose);
  const style: React.CSSProperties = {
    position: "absolute",
    top: position?.top ?? 56,
    right: position?.right ?? 16,
    left: position?.left,
    zIndex: 25,
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Panel theme"
      style={style}
      className="flex w-[300px] flex-col gap-3 rounded-lg border border-paper-line bg-surface p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Panel theme
        </span>
        {busy && (
          <span className="font-mono text-[10px] text-ink-faint">saving…</span>
        )}
      </div>
      <p className="px-1 text-xs text-ink-muted">
        Recolor every node, label, and connector at once.
      </p>

      <ColorPanel currentPalette={null} busy={busy} onChange={onColorChange} />

      <div className="my-1 h-px bg-paper-line" />
      <div className="flex items-center justify-end px-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Shared dismiss-on-outside-click hook
// ============================================================================

function useDismissable(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onClose();
    }
    const t = window.setTimeout(
      () => window.addEventListener("mousedown", onDown),
      0
    );
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return ref;
}

// ============================================================================
// Color helpers
// ============================================================================

/**
 * Derive a coherent fill/stroke/text triple from a single brand-medium color.
 * Input is the stroke (medium lightness); fill is a desaturated lighter tint
 * and text is a darker, slightly more saturated variant.
 */
export function deriveTriple(brandHex: string): ColorTriple {
  const { h, s, l } = hexToHsl(brandHex);
  const fillLight = Math.min(96, Math.max(82, l + 38));
  const fillSat = Math.max(15, Math.min(55, s - 28));
  const textLight = Math.max(8, l - 22);
  const textSat = Math.min(100, s + 8);
  return {
    fill: hslToHex(h, fillSat, fillLight),
    stroke: hslToHex(h, s, l),
    text: hslToHex(h, textSat, textLight),
  };
}

function shiftLightness(hex: string, shift: number): string {
  const { h, s, l } = hexToHsl(hex);
  const ll = Math.max(5, Math.min(95, l + shift));
  return hslToHex(h, s, ll);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { h: 0, s: 0, l: 50 };
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const light = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      case b:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: hue * 360, s: sat * 100, l: light * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
