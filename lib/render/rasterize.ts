import { Resvg } from "@resvg/resvg-js";

export interface RasterResult {
  png: Buffer;
  base64: string;
  width: number;
  height: number;
}

/**
 * Rasterize an SVG string to a PNG buffer for vision-critique input.
 *
 * resvg is pure-Rust and runs in-process — ~80ms for a typical 680×H
 * panel, no browser. We only need the PNG to be *legible* to the vision
 * model, not export-quality, so the default width is 800px (smaller =
 * fewer pixels in the request payload, faster vision call).
 *
 * Throws on parse failure. Callers in render.ts skip critique silently
 * when this raises so an unrasterizable SVG can still ship through the
 * pipeline — the render layer never blocks on a critique-only failure.
 */
export function svgToPng(svg: string, opts: { width?: number } = {}): RasterResult {
  const width = opts.width ?? 800;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    // Match the panel chrome — every template assumes a paper-white
    // backdrop, so transparent rasters would mislead the critique model.
    background: "white",
    font: { loadSystemFonts: true },
  });
  const pngBuf = Buffer.from(resvg.render().asPng());
  // resvg doesn't expose post-render dims on the asPng() return; pull them
  // off the source SVG's intrinsic ratio via a parsed bbox.
  const bbox = resvg.innerBBox();
  const aspect = bbox && bbox.height > 0 ? bbox.width / bbox.height : 1;
  return {
    png: pngBuf,
    base64: pngBuf.toString("base64"),
    width,
    height: Math.round(width / aspect),
  };
}
