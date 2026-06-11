import type {
  BrandKit,
  Explainer,
  RenderedPanel,
  TemplateId,
} from "../shared/schemas";
import type { ExportFormat } from "../export/dimensions";

/**
 * Inputs every template renderer receives. Templates may use as many or
 * as few of these as their identity calls for — Receipt uses line items
 * from the panel plan; Editorial Broadsheet wants the full body text;
 * Terminal Brutalist mostly cares about heading + caption.
 */
export interface PanelRenderInput {
  explainer: Explainer;
  panel: RenderedPanel;
  format: ExportFormat;
  panelIndex: number;
  totalPanels: number;
  brand?: BrandKit | null;
}

export interface AttributionRenderInput {
  explainer: Explainer;
  format: ExportFormat;
  brand?: BrandKit | null;
}

export interface StackedRenderInput {
  explainer: Explainer;
  format: ExportFormat;
  brand?: BrandKit | null;
}

/**
 * The full visual-identity contract for one template. Each template owns
 * its own CSS — there's no shared chrome layer to fight, which keeps
 * format-mimicry templates (Receipt, Terminal) able to commit fully to
 * their look.
 */
export interface TemplateDef {
  id: TemplateId;
  name: string;
  /** Short bucket label used to group cards in the gallery. */
  category:
    | "Editorial"
    | "Reader"
    | "Technical"
    | "Document"
    | "Bold"
    | "Modern"
    | "Default";
  /** One-sentence pitch shown under the name on the gallery card. */
  tagline: string;
  /** Who this look is best for — shapes the picker copy. */
  audience: string;
  /** Static preview tokens for gallery cards. */
  preview: {
    background: string;
    foreground: string;
    accent: string;
    /** Short example heading that demonstrates the template's typography. */
    sampleHeading: string;
    fontFamily: string;
  };

  renderPanel(input: PanelRenderInput): Promise<string>;
  renderAttribution(input: AttributionRenderInput): Promise<string>;
  /**
   * For the whole-explainer "vertical stacked" export. Templates can
   * implement this however they like (one tall page, repeated panels,
   * a TOC at top). Optional — fall back to repeating renderPanel.
   */
  renderStacked?(input: StackedRenderInput): Promise<string>;
}
