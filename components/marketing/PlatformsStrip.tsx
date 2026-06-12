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
            <ul className="flex flex-wrap items-baseline gap-x-7 gap-y-4">
              {PLATFORMS.map((p) => (
                <li key={p.name} className="flex items-baseline gap-2">
                  <span className="text-sm font-medium tracking-tight text-ink sm:text-base">
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
