import { EXPORT_DIMENSIONS, type ExportFormat } from "../export/dimensions";
import { renderEditableSceneHtml } from "../editor/renderSceneSvg";
import { createEditableTemplateScene } from "../editor/templateScene";
import { templateSupportsPanelLayouts } from "./panelLayouts";
import type { PanelRenderInput, TemplateDef } from "./types";

const CANVAS_OVERRIDE_ATTRIBUTE = "data-readopp-canvas-override";

/** True when a panel contains a complete slide authored in the canvas. */
export function isCanvasOverride(content: string | null | undefined): boolean {
  return Boolean(
    content &&
      new RegExp(`${CANVAS_OVERRIDE_ATTRIBUTE}=["']true["']`, "i").test(
        content.slice(0, 2_000)
      )
  );
}

/** Mark Excalidraw's exported SVG as a complete-slide override. */
export function markCanvasOverride(svg: string): string {
  if (isCanvasOverride(svg)) return svg;
  return svg.replace(
    /<svg\b/i,
    `<svg ${CANVAS_OVERRIDE_ATTRIBUTE}="true"`
  );
}

/** Return a canvas SVG to template-managed mode without discarding its data. */
export function clearCanvasOverride(svg: string): string {
  return svg.replace(
    new RegExp(`\\s+${CANVAS_OVERRIDE_ATTRIBUTE}=["']true["']`, "i"),
    ""
  );
}

function renderCanvasOverride(content: string, format: ExportFormat): string {
  const { w, h } = EXPORT_DIMENSIONS[format];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><style>*{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#FAF9F5}body{display:grid;place-items:center}svg{display:block;width:100%;height:100%;max-width:100%;max-height:100%}</style></head><body>${content}</body></html>`;
}

/**
 * Render a panel through its chosen template unless the user has replaced
 * the complete slide in the canvas. Keeping this decision in one place makes
 * the in-app preview, PNG export, and video export agree.
 */
export async function renderPanelWithCanvasOverride(
  template: TemplateDef,
  input: PanelRenderInput
): Promise<string> {
  if (isCanvasOverride(input.panel.content)) {
    return renderCanvasOverride(input.panel.content, input.format);
  }
  // Preview, canvas, and export share this native scene for square panels.
  // Keeping one renderer prevents "looks close" drift between the chosen
  // composition and the file the user ultimately downloads.
  if (
    input.format === "square" &&
    templateSupportsPanelLayouts(template.id) &&
    input.panel.format === "svg"
  ) {
    return renderEditableSceneHtml(
      createEditableTemplateScene({
        explainer: input.explainer,
        panel: input.panel,
        panelIndex: input.panelIndex,
        totalPanels: input.totalPanels,
        template: template.id,
        brand: input.brand,
      })
    );
  }
  return template.renderPanel(input);
}
