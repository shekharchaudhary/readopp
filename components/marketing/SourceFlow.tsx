import { ReactNode } from "react";

/**
 * Napkin-style "sources flow into the input" visual. Four tile chips
 * (the kinds of things people read) sit above the real UrlInput card,
 * with hand-drawn curved arrows converging into it — so the first
 * interactive element on the page explains itself without a caption.
 */

const SOURCES: {
  label: string;
  icon: ReactNode;
  tilt: string;
  hue: string;
}[] = [
  {
    label: "Article URL",
    icon: <LinkIcon />,
    tilt: "-rotate-2",
    hue: "text-ink bg-[#38BDF8] border-transparent",
  },
  {
    label: "PDF",
    icon: <PdfIcon />,
    tilt: "rotate-1",
    hue: "text-ink bg-[#FB923C] border-transparent",
  },
  {
    label: "Newsletter",
    icon: <MailIcon />,
    tilt: "-rotate-1",
    hue: "text-ink bg-[#FACC15] border-transparent",
  },
  {
    label: "Research paper",
    icon: <PaperIcon />,
    tilt: "rotate-2",
    hue: "text-ink bg-[#A78BFA] border-transparent",
  },
];

export function SourceFlow({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {SOURCES.map((s) => (
          <div
            key={s.label}
            className={`flex cursor-default items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-[0_1px_2px_rgba(23,23,23,0.05)] transition-transform duration-200 hover:rotate-0 hover:-translate-y-0.5 ${s.tilt} ${s.hue}`}
          >
            <span>{s.icon}</span>
            <span className="whitespace-nowrap text-[13px] font-medium tracking-tight">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Hand-drawn arrows converging from the tiles into the card. */}
      <svg
        aria-hidden
        viewBox="0 0 400 64"
        className="flow-arrows mx-auto -mb-1 mt-1 h-14 w-full max-w-sm text-ink-soft"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          pathLength={1}
          d="M56 6 C 70 32, 128 44, 182 52 M176.4 54.2 L 182 52 L 177.3 48.3"
        />
        <path
          pathLength={1}
          d="M148 8 C 158 26, 176 38, 192 50 M186.0 49.3 L 192 50 L 189.6 44.5"
        />
        <path
          pathLength={1}
          d="M252 8 C 242 26, 224 38, 208 50 M210.4 44.5 L 208 50 L 214.0 49.3"
        />
        <path
          pathLength={1}
          d="M344 6 C 330 32, 272 44, 218 52 M222.7 48.3 L 218 52 L 223.6 54.2"
        />
      </svg>

      {children}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 2h5l3 3v9H4V2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m3 5 5 4 5-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 2h8v12H4V2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6 5h4M6 7.5h4M6 10h2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
