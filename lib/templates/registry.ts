import { TemplateIdSchema, type TemplateId } from "../shared/schemas";
import type { TemplateDef } from "./types";
import { auroraGlassTemplate } from "./aurora-glass";
import { bentoGridTemplate } from "./bento-grid";
import { boardingPassTemplate } from "./boarding-pass";
import { editorialBroadsheetTemplate } from "./editorial-broadsheet";
import { editorialBrutalistTemplate } from "./editorial-brutalist";
import { engineeringSpecTemplate } from "./engineering-spec";
import { galaxyBrainTemplate } from "./galaxy-brain";
import { highlighterReaderTemplate } from "./highlighter-reader";
import { indexCardTemplate } from "./index-card";
import { kindleHighlightTemplate } from "./kindle-highlight";
import { magazineCoverTemplate } from "./magazine-cover";
import { newYorkerFrameTemplate } from "./new-yorker-frame";
import { notebookCellTemplate } from "./notebook-cell";
import { receiptTemplate } from "./receipt";
import { risographZineTemplate } from "./risograph-zine";
import { stickyNotesTemplate } from "./sticky-notes";
import { swissPosterTemplate } from "./swiss-poster";
import { tabloidSplashTemplate } from "./tabloid-splash";
import { tachyonTemplate } from "./tachyon";
import { terminalBrutalistTemplate } from "./terminal-brutalist";

/**
 * All templates the export pipeline knows about. New visual identities
 * register themselves here; the export route looks up by id at render
 * time.
 *
 * `tachyon` is the implicit default — every explainer created before the
 * picker shipped renders with this look unless the user changes it.
 */
const TEMPLATES: Record<TemplateId, TemplateDef | undefined> = {
  // Default
  tachyon: tachyonTemplate,
  // Editorial
  "editorial-broadsheet": editorialBroadsheetTemplate,
  "magazine-cover": magazineCoverTemplate,
  "new-yorker-frame": newYorkerFrameTemplate,
  // Technical
  "terminal-brutalist": terminalBrutalistTemplate,
  "engineering-spec": engineeringSpecTemplate,
  "notebook-cell": notebookCellTemplate,
  // Document
  receipt: receiptTemplate,
  "index-card": indexCardTemplate,
  "boarding-pass": boardingPassTemplate,
  // Reader
  "highlighter-reader": highlighterReaderTemplate,
  "sticky-notes": stickyNotesTemplate,
  "kindle-highlight": kindleHighlightTemplate,
  // Bold
  "editorial-brutalist": editorialBrutalistTemplate,
  "tabloid-splash": tabloidSplashTemplate,
  "risograph-zine": risographZineTemplate,
  "galaxy-brain": galaxyBrainTemplate,
  // Modern
  "aurora-glass": auroraGlassTemplate,
  "bento-grid": bentoGridTemplate,
  "swiss-poster": swissPosterTemplate,
};

export const DEFAULT_TEMPLATE_ID: TemplateId = "tachyon";

export function getTemplate(id?: TemplateId | null): TemplateDef {
  const resolved = id ?? DEFAULT_TEMPLATE_ID;
  const def = TEMPLATES[resolved];
  // Fall back to the default if a template id is recognised by the
  // schema but doesn't have an implementation yet (the picker may show
  // "Coming soon" cards but the export route should never crash).
  return def ?? TEMPLATES[DEFAULT_TEMPLATE_ID]!;
}

/**
 * Every template that has a real renderer. Use this for gallery UIs.
 * Templates without an implementation are filtered out.
 */
export function listAvailableTemplates(): TemplateDef[] {
  return Object.values(TEMPLATES).filter(
    (t): t is TemplateDef => t !== undefined
  );
}

/**
 * All template ids the schema knows about, including ones not yet
 * implemented. UI uses this to show "coming soon" placeholders so the
 * roadmap is visible to users.
 */
export function listAllTemplateIds(): TemplateId[] {
  return TemplateIdSchema.options;
}

export function templateExists(id: TemplateId): boolean {
  return TEMPLATES[id] !== undefined;
}
