import { NextResponse } from "next/server";
import {
  listAllTemplateIds,
  templateExists,
  getTemplate,
} from "@/lib/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List every template the schema knows about, with metadata for the
 * picker UI. Unimplemented templates come back with available: false
 * so the gallery can show them as "coming soon" placeholders.
 */
export async function GET() {
  const templates = listAllTemplateIds().map((id) => {
    const available = templateExists(id);
    // getTemplate falls back to the default for missing ids, so for the
    // "coming soon" rows we synthesise a minimal preview from the id.
    const def = available ? getTemplate(id) : null;
    return def
      ? {
          id: def.id,
          name: def.name,
          category: def.category,
          tagline: def.tagline,
          audience: def.audience,
          preview: def.preview,
          available: true,
        }
      : placeholderFor(id);
  });
  return NextResponse.json({ templates });
}

function placeholderFor(id: string) {
  const NAMES: Record<string, { name: string; category: string; tagline: string; audience: string; preview: { background: string; foreground: string; accent: string; sampleHeading: string; fontFamily: string } }> = {
    "magazine-cover": {
      name: "Magazine Cover",
      category: "Editorial",
      tagline: "Full-bleed display serif with a single image-block masthead.",
      audience: "Indie writers, brand storytellers, founders with strong covers.",
      preview: {
        background: "#0F1115",
        foreground: "#FFFFFF",
        accent: "#FFB400",
        sampleHeading: "ISSUE 04 — How we ship.",
        fontFamily: "ui-serif, 'Tiempos Headline', Georgia, serif",
      },
    },
    "new-yorker-frame": {
      name: "New Yorker Frame",
      category: "Editorial",
      tagline: "Thin black border, Caslon, captioned visual — magazine page energy.",
      audience: "Essayists, critics, longform commentators.",
      preview: {
        background: "#FFFFFF",
        foreground: "#1A1A1A",
        accent: "#1A1A1A",
        sampleHeading: "A Personal History of Caching",
        fontFamily: "'Adobe Caslon Pro', 'ITC Caslon', Georgia, serif",
      },
    },
    "engineering-spec": {
      name: "Engineering Spec",
      category: "Technical",
      tagline: "RFC-style spec doc with numbered sections and code blocks.",
      audience: "Devtools founders, infra engineers, tech-lead writers.",
      preview: {
        background: "#FAFAFA",
        foreground: "#0A0A0A",
        accent: "#2962FF",
        sampleHeading: "RFC-014: Stream Resumption",
        fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
      },
    },
    "notebook-cell": {
      name: "Notebook Cell",
      category: "Technical",
      tagline: "Jupyter / Observable cell with input number and output frame.",
      audience: "Data scientists, ML researchers, applied AI writers.",
      preview: {
        background: "#FAFAFA",
        foreground: "#1A1A1A",
        accent: "#0066CC",
        sampleHeading: "In [04]: training_loop.run()",
        fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
      },
    },
    "index-card": {
      name: "Index Card",
      category: "Document",
      tagline: "Ruled Zettelkasten card with metadata header and tag footer.",
      audience: "Second-brain creators, researchers, PKM nerds.",
      preview: {
        background: "#FFFEF7",
        foreground: "#1A1A1A",
        accent: "#C0392B",
        sampleHeading: "047 / on focused reading",
        fontFamily: "'iA Writer Quattro', 'IBM Plex Sans', sans-serif",
      },
    },
    "boarding-pass": {
      name: "Boarding Pass",
      category: "Document",
      tagline: "Airline ticket with gate, seat, and a perforated tear-off stub.",
      audience: "Travel writers, narrative creators, founders telling journeys.",
      preview: {
        background: "#F4F1EA",
        foreground: "#1A1A1A",
        accent: "#0033A0",
        sampleHeading: "Gate 04 · Seat 12A",
        fontFamily: "ui-sans-serif, 'Inter', system-ui, sans-serif",
      },
    },
    "sticky-notes": {
      name: "Sticky Notes",
      category: "Reader",
      tagline: "Overlapped Post-it notes with handwritten ink.",
      audience: "Workshop facilitators, product strategists, teachers.",
      preview: {
        background: "#FAFAFA",
        foreground: "#1A1A1A",
        accent: "#FFE066",
        sampleHeading: "stickies for what mattered",
        fontFamily: "'Caveat', 'Reenie Beanie', cursive",
      },
    },
    "kindle-highlight": {
      name: "Kindle Highlight",
      category: "Reader",
      tagline: "E-reader excerpt with location marker and quiet annotation.",
      audience: "Book reviewers, learn-in-public readers, librarians-of-Twitter.",
      preview: {
        background: "#F8F5EE",
        foreground: "#1A1A1A",
        accent: "#7A6650",
        sampleHeading: "Location 1820 · highlighted",
        fontFamily: "ui-serif, 'Bookerly', 'IBM Plex Serif', Georgia, serif",
      },
    },
    "editorial-brutalist": {
      name: "Editorial Brutalist",
      category: "Bold",
      tagline: "Pentagram-scale type that bleeds off the panel edge.",
      audience: "Opinionated founders, contrarians, hot-take essayists.",
      preview: {
        background: "#FFEB00",
        foreground: "#0A0A0A",
        accent: "#0A0A0A",
        sampleHeading: "STOP. THINK. SHIP.",
        fontFamily: "'Druk Wide', 'GT Sectra', 'Inter', sans-serif",
      },
    },
    "tabloid-splash": {
      name: "Tabloid Splash",
      category: "Bold",
      tagline: "UK tabloid energy — screaming headlines and color blocks.",
      audience: "B2B humourists, marketing parodists, hot-take operators.",
      preview: {
        background: "#E03131",
        foreground: "#FFFFFF",
        accent: "#FFD500",
        sampleHeading: "SHOCK! AGENT FORGETS CONTEXT.",
        fontFamily: "'Knockout', 'Champion Gothic', 'Inter', sans-serif",
      },
    },
    "risograph-zine": {
      name: "Risograph Zine",
      category: "Bold",
      tagline: "Two-color riso print with deliberate misregistration and grain.",
      audience: "Designers, brand strategists, indie founders, zine creators.",
      preview: {
        background: "#FFFCEB",
        foreground: "#1A1A1A",
        accent: "#FF48B0",
        sampleHeading: "small studies in design taste",
        fontFamily: "'GT America Mono', 'IBM Plex Mono', monospace",
      },
    },
  };
  const fallback = NAMES[id] ?? {
    name: id,
    category: "Editorial",
    tagline: "Coming soon.",
    audience: "—",
    preview: {
      background: "#F1EFE8",
      foreground: "#1A1A1A",
      accent: "#1F97DC",
      sampleHeading: "Coming soon",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    },
  };
  return { id, ...fallback, available: false };
}
