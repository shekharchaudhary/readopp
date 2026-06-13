import { Reveal } from "./Reveal";

const PLATFORMS = [
  { name: "Reels", dims: "1080 × 1920", kind: "MP4" },
  { name: "TikTok", dims: "1080 × 1920", kind: "MP4" },
  { name: "Shorts", dims: "1080 × 1920", kind: "MP4" },
  { name: "Instagram feed", dims: "1080 × 1080", kind: "PNG · MP4" },
  { name: "LinkedIn", dims: "1200 × 627", kind: "PNG" },
];

export function PlatformsStrip() {
  return (
    <section className="border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <Reveal>
          <div className="grid items-baseline gap-8 sm:grid-cols-[180px_1fr]">
            <p className="text-xs font-medium tracking-tight text-ink-muted">
              Output
            </p>
            <ul className="flex flex-wrap items-center gap-2.5">
              {PLATFORMS.map((p) => (
                <li
                  key={p.name}
                  className="flex cursor-default items-baseline gap-2 rounded-full border border-paper-line bg-surface px-3.5 py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_8px_20px_-12px_rgba(196,122,60,0.4)]"
                >
                  <span className="text-sm font-medium tracking-tight text-ink">
                    {p.name}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {p.dims}
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {p.kind}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
