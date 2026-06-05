"use client";

import type { FontFamilyKey } from "@/lib/edit/sceneGraph";

/**
 * Compact dark popover for editing text typography. Matches ColorPicker's
 * dark surface so toolbar popovers feel like one family.
 *
 * Controls:
 *   - Font family (Sans / Serif / Mono / Display)
 *   - Size (stepper with - / + and a presets row)
 *   - Weight (Regular 400 / Medium 500 / Bold 700)
 *   - Italic toggle
 *   - Alignment (start / middle / end → maps to text-anchor)
 */

interface Props {
  family: FontFamilyKey;
  size: number;
  weight: number;
  italic: boolean;
  align: "start" | "middle" | "end";

  onFamily: (k: FontFamilyKey) => void;
  onSize: (size: number) => void;
  onWeight: (weight: number) => void;
  onItalic: (italic: boolean) => void;
  onAlign: (align: "start" | "middle" | "end") => void;
}

const FAMILIES: { key: FontFamilyKey; label: string; previewClass: string }[] = [
  { key: "sans", label: "Sans", previewClass: "font-sans" },
  { key: "serif", label: "Serif", previewClass: "font-serif" },
  { key: "mono", label: "Mono", previewClass: "font-mono" },
  { key: "display", label: "Display", previewClass: "font-sans tracking-tight" },
];

const SIZE_PRESETS = [12, 14, 16, 20, 24, 32, 48, 56];
const WEIGHTS: { value: number; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 700, label: "Bold" },
];

export function TypographyPopover({
  family,
  size,
  weight,
  italic,
  align,
  onFamily,
  onSize,
  onWeight,
  onItalic,
  onAlign,
}: Props) {
  return (
    <div className="w-[280px] space-y-3 rounded-lg border border-ink/70 bg-[#1f1f1d] p-3 text-paper shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      {/* Family */}
      <Section name="Font">
        <div className="grid grid-cols-4 gap-1">
          {FAMILIES.map((f) => {
            const active = family === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFamily(f.key)}
                title={f.label}
                className={
                  "rounded-md px-2 py-1.5 text-[11px] transition-colors " +
                  (active
                    ? "bg-paper text-ink"
                    : "bg-white/10 text-paper hover:bg-white/20")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Size */}
      <Section name="Size">
        <div className="flex items-center gap-1.5">
          <Stepper
            value={size}
            min={6}
            max={96}
            step={1}
            onChange={onSize}
          />
          <div className="flex flex-wrap gap-1">
            {SIZE_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSize(s)}
                className={
                  "rounded px-1.5 py-0.5 text-[10px] transition-colors " +
                  (size === s
                    ? "bg-paper text-ink"
                    : "text-paper-line/70 hover:bg-white/10 hover:text-paper")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Weight */}
      <Section name="Weight">
        <div className="grid grid-cols-3 gap-1">
          {WEIGHTS.map((w) => {
            const active = weight === w.value;
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => onWeight(w.value)}
                style={{ fontWeight: w.value }}
                className={
                  "rounded-md px-2 py-1.5 text-[11px] transition-colors " +
                  (active
                    ? "bg-paper text-ink"
                    : "bg-white/10 text-paper hover:bg-white/20")
                }
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Style + alignment row */}
      <div className="flex items-center gap-3">
        <Section name="Style" className="flex-1">
          <button
            type="button"
            onClick={() => onItalic(!italic)}
            title="Italic"
            className={
              "h-7 w-9 rounded-md text-[12px] italic transition-colors " +
              (italic
                ? "bg-paper text-ink"
                : "bg-white/10 text-paper hover:bg-white/20")
            }
          >
            I
          </button>
        </Section>
        <Section name="Align" className="flex-1">
          <div className="flex gap-1">
            {(["start", "middle", "end"] as const).map((a) => {
              const active = align === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => onAlign(a)}
                  title={`Align ${a}`}
                  className={
                    "h-7 flex-1 rounded-md text-[10px] transition-colors " +
                    (active
                      ? "bg-paper text-ink"
                      : "bg-white/10 text-paper hover:bg-white/20")
                  }
                >
                  {a === "start" ? "L" : a === "middle" ? "C" : "R"}
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  name,
  children,
  className,
}: {
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-paper-line/80">
        {name}
      </div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex h-7 items-center gap-0.5 rounded-md border border-white/15 bg-white/10">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="h-7 w-6 text-paper hover:bg-white/10"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="h-7 w-10 bg-transparent text-center font-mono text-xs text-paper focus:outline-none"
        aria-label="Size"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="h-7 w-6 text-paper hover:bg-white/10"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
