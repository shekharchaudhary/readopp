import type { RenderedPanel } from "../shared/schemas";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

/**
 * Simple titled-card fallback so a single bad panel never breaks an explainer.
 */
export function buildFallbackPanel(
  sectionId: string,
  heading: string,
  caption: string
): RenderedPanel {
  const titleLines = wrapText(heading, 60);
  const bodyLines = wrapText(caption, 70).slice(0, 6);

  const titleH = titleLines.length * 22 + 8;
  const bodyH = bodyLines.length * 20;
  const H = 80 + titleH + bodyH + 40;

  const titleTspans = titleLines
    .map(
      (l, i) =>
        `<tspan x="56" dy="${i === 0 ? 0 : 22}">${escapeXml(l)}</tspan>`
    )
    .join("");
  const bodyTspans = bodyLines
    .map(
      (l, i) =>
        `<tspan x="56" dy="${i === 0 ? 0 : 20}">${escapeXml(l)}</tspan>`
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${H}" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>${escapeXml(heading)}</title>
  <desc>${escapeXml(caption)}</desc>
  <rect x="40" y="40" width="600" height="${H - 80}" rx="10" fill="#F1EFE8" stroke="#5F5E5A" stroke-width="1"/>
  <text x="56" y="80" font-size="14" font-weight="500" fill="#2C2C2A">${titleTspans}</text>
  <text x="56" y="${80 + titleH + 8}" font-size="12" font-weight="400" fill="#3a3a3a">${bodyTspans}</text>
</svg>`;

  return {
    sectionId,
    caption,
    format: "svg",
    content: svg,
    validated: true,
    fallback: true,
  };
}
