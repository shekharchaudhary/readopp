"use client";

/**
 * Dark popover for fine-grain element style: opacity, stroke width, corner
 * radius. Surface and typography match ColorPicker / TypographyPopover so
 * the toolbar popovers feel like one family.
 */

interface Props {
  opacity: number;
  onOpacity: (v: number) => void;
  /** Stroke width control only renders when the element actually has a stroke. */
  strokeWidth?: number;
  onStrokeWidth?: (v: number) => void;
  /** Corner radius (rx/ry) only renders for rects. */
  cornerRadius?: number;
  onCornerRadius?: (v: number) => void;
}

export function AdjustPopover(props: Props) {
  const {
    opacity,
    onOpacity,
    strokeWidth,
    onStrokeWidth,
    cornerRadius,
    onCornerRadius,
  } = props;
  return (
    <div className="w-[260px] space-y-3 rounded-lg border border-ink/70 bg-[#1f1f1d] p-3 text-paper shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <Slider
        label="Opacity"
        value={opacity}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={onOpacity}
      />
      {strokeWidth !== undefined && onStrokeWidth && (
        <Slider
          label="Stroke width"
          value={strokeWidth}
          min={0}
          max={20}
          step={0.5}
          format={(v) => v.toFixed(1)}
          onChange={onStrokeWidth}
        />
      )}
      {cornerRadius !== undefined && onCornerRadius && (
        <Slider
          label="Corner radius"
          value={cornerRadius}
          min={0}
          max={48}
          step={1}
          format={(v) => `${Math.round(v)}`}
          onChange={onCornerRadius}
        />
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-paper-line/80">
          {label}
        </span>
        <span className="font-mono text-[11px] text-paper">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="adjust-slider w-full"
        aria-label={label}
      />
      <style jsx>{`
        :global(.adjust-slider) {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
        }
        :global(.adjust-slider::-webkit-slider-thumb) {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #1f97dc;
          cursor: pointer;
        }
        :global(.adjust-slider::-moz-range-thumb) {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #1f97dc;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
