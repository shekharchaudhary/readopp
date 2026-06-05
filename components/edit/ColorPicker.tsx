"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Compact floating color picker, inspired by Napkin AI:
 *  ┌──────────────────────────────────┐
 *  │  OPACITY      [▓▓▓▓░░░░░░]       │
 *  │  BRIGHTNESS   [▓▓▓▓░░░░░░]       │
 *  │  ⚪ ⚫ 🟦 🟦 🟨 🟧 🟥 🟪 🟩 ▲     │
 *  │  💧  [1AC6FF___________________]  │
 *  └──────────────────────────────────┘
 *
 * Dark surface so colors pop. Opacity slider drives the alpha channel;
 * brightness slider is a light↔dark sweep around the picked hue (uses
 * HSL lightness so the user can fine-tune any swatch without re-picking).
 * Eyedropper uses window.EyeDropper when available (Chromium / Edge).
 *
 * Color values are 6- or 8-char hex (#rrggbb or #rrggbbaa). `null` means
 * the parent should set fill / stroke to "none".
 */

const SWATCHES = [
  "#ffffff",
  "#a3a3a3",
  "#1a1a1a",
  "#185FA5",
  "#1F97DC",
  "#0F6E56",
  "#534AB7",
  "#854F0B",
  "#C04A2B",
  "#A23B73",
];

const RECENT_KEY = "readopp.color.recent";
const RECENT_MAX = 8;

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperConstructor {
  new (): { open: () => Promise<EyeDropperResult> };
}
function getEyeDropper(): EyeDropperConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { EyeDropper?: EyeDropperConstructor };
  return w.EyeDropper ?? null;
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // localStorage best-effort
  }
}
export function rememberColor(color: string): void {
  const norm = normalize(color);
  if (!norm) return;
  const list = loadRecent();
  const next = [
    norm,
    ...list.filter((c) => c.toLowerCase() !== norm.toLowerCase()),
  ];
  saveRecent(next);
}

// ---------- Color math ----------

interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

function normalize(input: string): string | null {
  const v = input.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(v)) {
    return "#" + v.split("").map((c) => c + c).join("");
  }
  if (/^[0-9a-f]{6}$/.test(v) || /^[0-9a-f]{8}$/.test(v)) {
    return "#" + v;
  }
  return null;
}

function parseHex(hex: string): RGB | null {
  const v = normalize(hex);
  if (!v) return null;
  const h = v.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function rgbToHex(rgb: RGB): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  const alpha = rgb.a < 1 ? part(rgb.a * 255) : "";
  return ("#" + part(rgb.r) + part(rgb.g) + part(rgb.b) + alpha).toLowerCase();
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
  a = 1
): RGB {
  function hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v, a };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
    a,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return rgbToHex({ ...rgb, a: Math.max(0, Math.min(1, alpha)) });
}

function withLightness(hex: string, lightness: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  const next = hslToRgb(hsl.h, hsl.s, lightness, rgb.a);
  return rgbToHex(next);
}

// ---------- Component ----------

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
  allowNone?: boolean;
  /** Optional label rendered at the top (small uppercase). */
  label?: string;
}

export function ColorPicker({ value, onChange, allowNone, label }: Props) {
  const [hexDraft, setHexDraft] = useState<string>(value ?? "");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setHexDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function pick(color: string) {
    const norm = normalize(color);
    if (!norm) return;
    onChange(norm);
    rememberColor(norm);
    setRecent(loadRecent());
  }

  function commitHex() {
    const norm = normalize(hexDraft);
    if (norm) pick(norm);
    else setHexDraft(value ?? "");
  }

  const rgb = useMemo(() => (value ? parseHex(value) : null), [value]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);

  // Sliders work on a base hue derived from `value`. If no value yet, fall
  // back to a neutral mid-gray so the sliders still render.
  const base = value ?? "#999999";

  function onOpacityChange(alpha: number) {
    if (!value) return;
    onChange(withAlpha(value, alpha));
  }

  function onBrightnessChange(lightness: number) {
    onChange(withLightness(base, lightness));
  }

  const eye = getEyeDropper();
  const eyeRef = useRef<{ open: () => Promise<EyeDropperResult> } | null>(null);
  async function openEyeDropper() {
    if (!eye) return;
    try {
      if (!eyeRef.current) eyeRef.current = new eye();
      const result = await eyeRef.current.open();
      pick(result.sRGBHex);
    } catch {
      // user cancelled — ignore
    }
  }

  const currentAlpha = rgb?.a ?? 1;
  const currentLightness = hsl?.l ?? 0.5;

  // Brightness track: gradient from black → base hue → white
  const brightnessTrack = useMemo(() => {
    if (!rgb) return "linear-gradient(to right, #000, #999, #fff)";
    const hsl0 = rgbToHsl(rgb);
    const dark = rgbToHex(hslToRgb(hsl0.h, hsl0.s, 0.05, 1));
    const mid = rgbToHex(hslToRgb(hsl0.h, hsl0.s, 0.5, 1));
    const light = rgbToHex(hslToRgb(hsl0.h, hsl0.s, 0.95, 1));
    return `linear-gradient(to right, ${dark}, ${mid}, ${light})`;
  }, [rgb]);

  // Opacity track: checker + alpha gradient of the current hue
  const opacityTrack = useMemo(() => {
    const baseHex = (value ?? "#999999").slice(0, 7);
    return `linear-gradient(to right, ${baseHex}00, ${baseHex}ff)`;
  }, [value]);

  return (
    <div className="w-[280px] rounded-lg border border-ink/70 bg-[#1f1f1d] p-3 text-paper shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      {label && (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-paper-line">
          {label}
        </div>
      )}

      {/* Opacity */}
      <div className="mb-2">
        <Row name="Opacity" track={opacityTrack}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={currentAlpha}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="track-input"
            aria-label="Opacity"
          />
        </Row>
      </div>

      {/* Brightness */}
      <div className="mb-3">
        <Row name="Brightness" track={brightnessTrack}>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={currentLightness}
            onChange={(e) => onBrightnessChange(parseFloat(e.target.value))}
            className="track-input"
            aria-label="Brightness"
          />
        </Row>
      </div>

      {/* Swatch grid */}
      <div className="mb-3 grid grid-cols-5 gap-1.5">
        {SWATCHES.map((s) => {
          const selected =
            (value ?? "").toLowerCase().slice(0, 7) === s.toLowerCase();
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              title={s}
              aria-label={s}
              className={
                "h-7 w-7 rounded-full border transition-transform " +
                (selected
                  ? "scale-110 border-paper shadow-[0_0_0_2px_#1f1f1d,0_0_0_3px_#1F97DC]"
                  : "border-white/30 hover:scale-105")
              }
              style={{ background: s }}
            />
          );
        })}
      </div>

      {recent.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              title={`Recent ${c}`}
              className="h-5 w-5 rounded-full border border-white/30 transition-transform hover:scale-105"
              style={{ background: c }}
            />
          ))}
        </div>
      )}

      {/* Hex + eyedropper */}
      <div className="flex items-center gap-1.5">
        {eye && (
          <button
            type="button"
            onClick={openEyeDropper}
            title="Pick a color from the page"
            aria-label="Eyedropper"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-paper transition-colors hover:bg-white/20"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M11 1.5L14.5 5L7 12.5L3.5 13L4 9.5L11 1.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M2 14L3 13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2 py-1">
          <span
            className="h-4 w-4 rounded-full border border-white/30"
            style={{ background: value || "transparent" }}
          />
          <input
            type="text"
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="#1F97DC"
            className="w-full bg-transparent font-mono text-xs uppercase text-paper placeholder:text-paper-line/60 focus:outline-none"
            aria-label="Hex color"
          />
        </div>
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="No fill"
            aria-label="None"
            className={
              "rounded-md border px-2 py-1 text-[10px] transition-colors " +
              (value === null
                ? "border-paper bg-paper text-ink"
                : "border-white/15 bg-white/10 text-paper hover:bg-white/20")
            }
          >
            None
          </button>
        )}
      </div>

      <style jsx>{`
        :global(.track-input) {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 18px;
          background: transparent;
          margin: 0;
        }
        :global(.track-input::-webkit-slider-thumb) {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #1F97DC;
          cursor: pointer;
          margin-top: -2px;
        }
        :global(.track-input::-moz-range-thumb) {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #1F97DC;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Row({
  name,
  track,
  children,
}: {
  name: string;
  track: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-paper-line/80">
          {name}
        </span>
      </div>
      <div
        className="relative h-3 rounded-full"
        style={{
          background: track,
          backgroundImage:
            name === "Opacity"
              ? `linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%), ${track}`
              : track,
          backgroundSize:
            name === "Opacity" ? "8px 8px, 8px 8px, 8px 8px, 8px 8px, 100% 100%" : undefined,
          backgroundPosition:
            name === "Opacity"
              ? "0 0, 0 4px, 4px -4px, -4px 0px, 0 0"
              : undefined,
        }}
      >
        <div className="absolute inset-0 flex items-center">{children}</div>
      </div>
    </div>
  );
}
