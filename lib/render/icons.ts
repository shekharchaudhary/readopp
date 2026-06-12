/**
 * Curated outline icon library for deterministic panel renderers.
 *
 * Every icon is hand-tuned to a 24×24 box, stroke-only (no fills), drawn in
 * the same visual weight so any two icons sit comfortably side by side in a
 * scene. We curate rather than let the model draw objects freeform — object
 * fidelity is what makes a panel read instantly, and generative paths are
 * unreliable at that.
 *
 * `iconSvg` compensates stroke-width for scale, so line weight stays
 * constant whether an icon renders at 24px or 96px.
 */

export const ICON_NAMES = [
  "lightbulb",
  "tag",
  "clock",
  "dollar",
  "gauge",
  "rocket",
  "shield",
  "book",
  "users",
  "person",
  "gear",
  "trend",
  "bars",
  "database",
  "cloud",
  "lock",
  "key",
  "leaf",
  "target",
  "scale",
  "wrench",
  "globe",
  "chip",
  "mail",
  "search",
  "flag",
  "flame",
  "layers",
  "link",
  "heart",
  "star",
  "document",
  "terminal",
  "pin",
  "calendar",
  "bolt",
  "eye",
  "warning",
  "package",
  "trophy",
  "pencil",
  "speaker",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function isIconName(s: string | null | undefined): s is IconName {
  return Boolean(s) && (ICON_NAMES as readonly string[]).includes(s as string);
}

/** Inner SVG elements per icon, authored against a 24×24 viewBox. */
const PARTS: Record<IconName, string> = {
  lightbulb:
    '<path d="M12 3a6.5 6.5 0 0 0-3.8 11.8c.8.6 1.3 1.4 1.3 2.2v.5h5v-.5c0-.8.5-1.6 1.3-2.2A6.5 6.5 0 0 0 12 3z"/><path d="M9.7 19h4.6"/><path d="M10.2 21h3.6"/>',
  tag: '<path d="M4 4h7.2L20 12.8a1.4 1.4 0 0 1 0 2L14.8 20a1.4 1.4 0 0 1-2 0L4 11.2V4z"/><circle cx="8.3" cy="8.3" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
  dollar:
    '<path d="M12 4.5v15"/><path d="M15.8 7.5c-.7-1.1-2.1-1.7-3.8-1.7-2.1 0-3.7 1.1-3.7 2.8 0 1.6 1.3 2.3 3.6 2.9 2.5.6 4.1 1.4 4.1 3.3 0 1.8-1.8 3-4 3-1.9 0-3.4-.8-4.1-2"/>',
  gauge:
    '<path d="M4 15.5a8.5 8.5 0 0 1 16 0"/><path d="M12 15.5l4.2-4.6"/><circle cx="12" cy="15.5" r="1.2"/><path d="M5.5 11.5l-1.2-.8M18.5 11.5l1.2-.8M12 6.5V5"/>',
  rocket:
    '<path d="M12 2.5c2.8 1.9 4.6 5.4 4.6 9.2l-2.3 2.8H9.7l-2.3-2.8c0-3.8 1.8-7.3 4.6-9.2z"/><circle cx="12" cy="9" r="1.7"/><path d="M9.7 14.5L7 18.2M14.3 14.5L17 18.2"/><path d="M12 14.5v4"/>',
  shield: '<path d="M12 3l7.5 3v5.2c0 4.6-3 8.2-7.5 10.3C7.5 19.4 4.5 15.8 4.5 11.2V6L12 3z"/><path d="M9 11.5l2.2 2.2L15.5 9"/>',
  book: '<path d="M3 4.5h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6V19h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H3V4.5z"/><path d="M12 7.5V22"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/><circle cx="16.8" cy="9.5" r="2.4"/><path d="M16.8 14c2.4.4 3.7 2.4 3.7 5"/>',
  person: '<circle cx="12" cy="7.5" r="3.8"/><path d="M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  gear: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.4"/><path d="M12 6V3.4M12 20.6V18M18 12h2.6M3.4 12H6M16.2 7.8l1.9-1.9M5.9 18.1l1.9-1.9M16.2 16.2l1.9 1.9M5.9 5.9l1.9 1.9"/>',
  trend: '<path d="M4 4.5v15h16"/><path d="M7 15l4-4 3 3 5.5-6.5"/><path d="M16 7.5h3.5V11"/>',
  bars: '<path d="M4 4.5v15h16"/><path d="M8.5 16v-5M12.5 16V8M16.5 16v-3.5"/>',
  database:
    '<ellipse cx="12" cy="5.5" rx="7" ry="2.8"/><path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
  cloud:
    '<path d="M7 18.5a4.3 4.3 0 0 1-.4-8.6 6 6 0 0 1 11.7 1.6 3.8 3.8 0 0 1-.8 7H7z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.2" r="1.3"/>',
  key: '<circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H21M18 12v3.2M21 12v2.2"/>',
  leaf: '<path d="M5 19.5C5 9.5 11 4.5 20 4.5c0 9-5 15-15 15z"/><path d="M5 19.5c3-5 7-9 11-11"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  scale:
    '<path d="M12 4.5v15M5 19.5h14M4.5 7.5h15"/><path d="M7 7.5l-3 5.5M7 7.5l3 5.5M4 13a3 3.2 0 0 0 6 0z"/><path d="M17 7.5l-3 5.5M17 7.5l3 5.5M14 13a3 3.2 0 0 0 6 0z"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.8 5.3 3.8 8.5s-1.4 6.1-3.8 8.5c-2.4-2.4-3.8-5.3-3.8-8.5s1.4-6.1 3.8-8.5z"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.2"/><rect x="10.4" y="10.4" width="3.2" height="3.2"/><path d="M9.5 7V3.5M14.5 7V3.5M9.5 20.5V17M14.5 20.5V17M7 9.5H3.5M7 14.5H3.5M20.5 9.5H17M20.5 14.5H17"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="M3.5 7.5l8.5 5.7 8.5-5.7"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.8"/><path d="M15 15l5.8 5.8"/>',
  flag: '<path d="M5.5 21V3.5"/><path d="M5.5 4.5c4-2 8.5 2 13.5 0v9c-5 2-9.5-2-13.5 0"/>',
  flame:
    '<path d="M12 3c1 3 4.3 4.6 4.3 8.4a4.8 4.8 0 0 1-9.6 0c0-1.9.9-3.4 1.9-4.9.5 1.4 1.2 2.1 2.2 2.4-.5-2 .1-4.2 1.2-5.9z"/>',
  layers: '<path d="M12 3.5l8.5 4.7L12 12.9 3.5 8.2 12 3.5z"/><path d="M3.5 12.5l8.5 4.7 8.5-4.7"/><path d="M3.5 16.5l8.5 4.7 8.5-4.7"/>',
  link: '<path d="M10 13.5a5 5 0 0 0 7.5.5l2.5-2.5a5 5 0 0 0-7.1-7.1L11.5 5.8"/><path d="M14 10.5a5 5 0 0 0-7.5-.5L4 12.5a5 5 0 0 0 7.1 7.1l1.4-1.4"/>',
  heart:
    '<path d="M12 20.3C7.2 16.6 3.8 13.6 3.8 9.8 3.8 7.2 5.8 5.2 8.2 5.2c1.6 0 3 .8 3.8 2.1.8-1.3 2.2-2.1 3.8-2.1 2.4 0 4.4 2 4.4 4.6 0 3.8-3.4 6.8-8.2 10.5z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>',
  document:
    '<path d="M6 3.5h7.5l4.5 4.5v12a.8.8 0 0 1-.8.8H6a.8.8 0 0 1-.8-.8v-16a.8.8 0 0 1 .8-.5z"/><path d="M13.5 3.5V8H18"/><path d="M9 13h6M9 16.5h6"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="1.8"/><path d="M7 10l3 2.5L7 15"/><path d="M12.5 15.5h5"/>',
  pin: '<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="9.8" r="2.4"/>',
  calendar:
    '<rect x="4" y="6" width="16" height="14.5" rx="1.8"/><path d="M4 10.5h16M8.5 3.5V8M15.5 3.5V8"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6l1-8z"/>',
  eye: '<path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
  warning: '<path d="M12 3.5L2.8 20h18.4L12 3.5z"/><path d="M12 9.5v4.5"/><path d="M12 17.2v.2"/>',
  package:
    '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>',
  trophy:
    '<path d="M7 4h10v5.5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1a4 4 0 0 0 3 3.9M17 6h3v1a4 4 0 0 1-3 3.9"/><path d="M12 14.5v3.5"/><path d="M8.5 20.5h7M10 18h4"/>',
  pencil:
    '<path d="M4.5 19.5l.9-3.6L16.6 4.7a2 2 0 0 1 2.8 2.8L8.1 18.6l-3.6.9z"/><path d="M14.6 6.7l2.8 2.8"/>',
  speaker:
    '<path d="M3.5 10v4a1 1 0 0 0 1 1h2.3l4.2 3.8V5.2L6.8 9H4.5a1 1 0 0 0-1 1z"/><path d="M14.5 9.3a3.8 3.8 0 0 1 0 5.4"/><path d="M17.2 6.8a7.4 7.4 0 0 1 0 10.4"/>',
};

export interface IconOpts {
  x: number;
  y: number;
  /** Rendered box size in px (icon is square). Default 24. */
  size?: number;
  stroke?: string;
  /** Visual stroke weight, scale-compensated. Default 1.6. */
  strokeWidth?: number;
}

/**
 * Returns a positioned <g> for the icon. (x, y) is the TOP-LEFT corner of
 * the icon's box. Stroke width is divided by the scale factor so the drawn
 * line weight stays constant at any size.
 */
export function iconSvg(name: IconName, opts: IconOpts): string {
  const { x, y, size = 24, stroke = "#1a1a1a", strokeWidth = 1.6 } = opts;
  const s = size / 24;
  const sw = (strokeWidth / s).toFixed(2);
  return (
    `<g transform="translate(${x} ${y}) scale(${s.toFixed(4)})" fill="none" ` +
    `stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ` +
    `stroke-linejoin="round">${PARTS[name]}</g>`
  );
}

/** One-line catalog for planner prompts. */
export const ICON_CATALOG_LINE = ICON_NAMES.join(", ");
