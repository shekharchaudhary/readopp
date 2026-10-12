import type { TemplateId } from "../shared/schemas";

/**
 * Lightweight shared default for browser and server code. Keep this separate
 * from the renderer registry so client components do not bundle every
 * template implementation just to resolve an older explainer.
 */
export const DEFAULT_TEMPLATE_ID: TemplateId = "swiss-poster";
