export type ExportFormat = "square" | "vertical" | "landscape";

export const EXPORT_DIMENSIONS: Record<
  ExportFormat,
  { w: number; h: number; label: string }
> = {
  square: { w: 1080, h: 1080, label: "Instagram feed" },
  vertical: { w: 1080, h: 1920, label: "TikTok / Reels / Stories" },
  landscape: { w: 1200, h: 627, label: "LinkedIn" },
};

export function isExportFormat(s: string): s is ExportFormat {
  return s === "square" || s === "vertical" || s === "landscape";
}
