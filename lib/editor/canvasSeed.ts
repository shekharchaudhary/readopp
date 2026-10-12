import type { RenderedPanel, TemplateId } from "../shared/schemas";
import { isCanvasOverride } from "../templates/canvasOverride";

/** Whether the canvas must be seeded from the rendered template, not raw SVG. */
export function usesRenderedTemplateSeed(
  panel: RenderedPanel,
  template: TemplateId | undefined
): boolean {
  return Boolean(
    template &&
      template !== "tachyon" &&
      !isCanvasOverride(panel.content)
  );
}

/** Invalidates stale auto-saved scenes when the visible design changes. */
export function canvasSeedVersion(
  panel: RenderedPanel,
  template: TemplateId | undefined,
  resolvedLayout?: string
): string {
  return [
    "template-v2-native",
    template ?? "tachyon",
    panel.heading,
    panel.caption,
    panel.themeColor ?? "default",
    panel.layoutVariant ?? "auto",
    resolvedLayout ?? "isolated",
    contentChecksum(JSON.stringify(panel.copyOverrides ?? {})),
    contentChecksum(panel.content),
  ].join("::");
}

function contentChecksum(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function canvasSeedUrl(
  explainerId: string,
  sectionId: string
): string {
  return `/api/explainers/${explainerId}/panels/${sectionId}/canvas-seed`;
}
