import { JSDOM } from "jsdom";

const ACTIVE_ELEMENTS = "script,foreignObject,iframe,object,embed,link,meta,base,form,animate,animateMotion,animateTransform,set";
const SAFE_DATA = /^data:(?:image\/(?:png|jpeg|gif|webp)|font\/(?:woff2?|ttf|otf));base64,[a-z0-9+/=\s]+$/i;

function unsafeCss(value: string): boolean {
  // CSS escapes and comments can disguise URL schemes and at-rules.
  const normalized = value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  if (/\\/.test(normalized)) return true;
  if (/@import|expression\s*\(|-moz-binding/i.test(normalized)) return true;
  return [...normalized.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)]
    .some((match) => {
      const target = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      return !target.startsWith("#") && !SAFE_DATA.test(target);
    });
}

function unsafeAttribute(name: string, value: string): boolean {
  if (/^on/i.test(name) || /^(?:srcdoc|srcset|ping)$/i.test(name)) return true;
  if (/^(?:href|xlink:href|src|poster|background|action|formaction|data)$/i.test(name)) {
    return !value.startsWith("#") && !SAFE_DATA.test(value);
  }
  return unsafeCss(value);
}

/** Reject executable markup and remote resources before persisting user edits. */
export function panelContentSafetyError(content: string): string | null {
  const doc = new JSDOM(`<body>${content}</body>`).window.document;
  if (doc.querySelector(ACTIVE_ELEMENTS)) return "Active elements are not allowed in panel artwork.";
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (unsafeAttribute(attribute.name, attribute.value)) return "Event handlers and external resources are not allowed in panel artwork.";
    }
    if (element.tagName.toLowerCase() === "style" && unsafeCss(element.textContent ?? "")) return "External or executable CSS is not allowed.";
  }
  return null;
}

/** Defense in depth for older stored artwork, before any preview or export. */
export function sanitizePanelContent(content: string): string {
  const doc = new JSDOM(`<body>${content}</body>`).window.document;
  doc.querySelectorAll(ACTIVE_ELEMENTS).forEach((element) => element.remove());
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (unsafeAttribute(attribute.name, attribute.value)) element.removeAttribute(attribute.name);
    }
    if (element.tagName.toLowerCase() === "style" && unsafeCss(element.textContent ?? "")) element.remove();
  }
  return doc.body.innerHTML;
}
