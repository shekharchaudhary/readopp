import {
  buildAttributionExportHtml,
  buildPanelExportHtml,
  buildStackedExportHtml,
} from "../export/buildExportHtml";
import type { TemplateDef } from "./types";

/**
 * Tachyon — the original Readopp look. Single-accent design with the
 * generated panel SVG/HTML at the center, brand chrome around it, and
 * a small QR in the footer.
 *
 * This file is a thin wrapper around buildExportHtml so legacy and new
 * code share a single rendering implementation while the template
 * registry can pick it by id.
 */
export const tachyonTemplate: TemplateDef = {
  id: "tachyon",
  name: "Tachyon",
  category: "Default",
  tagline: "Clean reader chrome with a single accent — the Readopp default.",
  audience: "General readers, founders, anyone shipping their first carousel.",
  preview: {
    background: "#F6F2EA",
    foreground: "#1A1A1A",
    accent: "#1F97DC",
    sampleHeading: "The Three Bugs Behind Claude Code's Decline",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  renderPanel: (input) => buildPanelExportHtml(input),
  renderAttribution: (input) => buildAttributionExportHtml(input),
  renderStacked: (input) => buildStackedExportHtml(input),
};
