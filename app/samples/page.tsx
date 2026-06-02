export const dynamic = "force-static";

const ICEBERG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>Iceberg</title>
  <desc>What ships vs what it took to build</desc>

  <!-- Underwater tint -->
  <rect x="0" y="200" width="680" height="280" fill="#E6F1FB" opacity="0.55"/>

  <!-- Surface lines -->
  <line x1="0" y1="200" x2="680" y2="200" stroke="#185FA5" stroke-width="1" opacity="0.4"/>
  <line x1="0" y1="208" x2="680" y2="208" stroke="#185FA5" stroke-width="1" opacity="0.18"/>

  <!-- Iceberg above water -->
  <path d="M 300 200 L 330 108 L 366 156 L 396 200 Z" fill="#ffffff" stroke="#185FA5" stroke-width="1.5"/>

  <!-- Iceberg below water -->
  <path d="M 272 200 L 232 252 L 218 322 L 240 400 L 312 432 L 396 422 L 444 380 L 458 290 L 430 220 L 410 200 Z" fill="#ffffff" stroke="#185FA5" stroke-width="1.5" opacity="0.92"/>

  <!-- Faded percentage in the underwater mass -->
  <text x="338" y="316" font-size="56" font-weight="500" fill="#185FA5" text-anchor="middle" opacity="0.18">90%</text>

  <!-- Leader: visible peak -->
  <line x1="384" y1="135" x2="490" y2="105" stroke="#6B6B6B" stroke-width="1"/>
  <circle cx="384" cy="135" r="2.5" fill="#6B6B6B"/>
  <text x="500" y="100" font-size="14" font-weight="500" fill="#0C447C">The 10% users see</text>
  <text x="500" y="118" font-size="12" fill="#3a3a3a">Polished UI, the demo,</text>
  <text x="500" y="134" font-size="12" fill="#3a3a3a">the launch tweet</text>

  <!-- Leader: underwater -->
  <line x1="290" y1="340" x2="160" y2="380" stroke="#6B6B6B" stroke-width="1"/>
  <circle cx="290" cy="340" r="2.5" fill="#6B6B6B"/>
  <text x="40" y="376" font-size="14" font-weight="500" fill="#0C447C">The 90% that built it</text>
  <text x="40" y="394" font-size="12" fill="#3a3a3a">Research, infra, ten</text>
  <text x="40" y="410" font-size="12" fill="#3a3a3a">attempts that didn't ship</text>
</svg>
`.trim();

const MOUNTAIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 500" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>The climb</title>
  <desc>Three camps on the way to a usable model</desc>

  <!-- Distant peaks -->
  <path d="M 80 470 L 200 290 L 280 360 L 380 250 L 480 320 L 580 230 L 680 470 Z" fill="#F1EFE8" opacity="0.7"/>

  <!-- Main mountain -->
  <path d="M 40 480 L 220 320 L 320 400 L 420 200 L 540 320 L 620 280 L 680 480 Z" fill="#FAEEDA" stroke="#854F0B" stroke-width="1.5"/>

  <!-- Snow cap -->
  <path d="M 400 240 L 420 200 L 444 244 L 432 254 L 422 246 L 412 254 Z" fill="#ffffff" stroke="#854F0B" stroke-width="1"/>

  <!-- Trail (zigzag) -->
  <path d="M 500 480 L 460 420 L 380 390 L 340 340 L 396 290 L 420 230" fill="none" stroke="#633806" stroke-width="1.5" stroke-dasharray="4 5" stroke-linecap="round"/>

  <!-- Summit marker -->
  <text x="420" y="184" font-size="12" font-weight="500" fill="#633806" text-anchor="middle">↑ usable model</text>

  <!-- Camp 1 (base) -->
  <circle cx="460" cy="420" r="5" fill="#633806"/>
  <line x1="460" y1="420" x2="460" y2="400" stroke="#633806" stroke-width="1.5"/>
  <path d="M 460 400 L 482 407 L 460 414 Z" fill="#633806"/>
  <line x1="470" y1="422" x2="560" y2="422" stroke="#6B6B6B" stroke-width="1" opacity="0.7"/>
  <text x="572" y="414" font-size="12" font-weight="500" fill="#854F0B">STAGE 1</text>
  <text x="572" y="432" font-size="14" font-weight="500" fill="#1a1a1a">Pretraining</text>
  <text x="572" y="450" font-size="12" fill="#3a3a3a">Trillions of</text>
  <text x="572" y="466" font-size="12" fill="#3a3a3a">tokens, raw</text>

  <!-- Camp 2 -->
  <circle cx="380" cy="390" r="5" fill="#633806"/>
  <line x1="380" y1="390" x2="380" y2="370" stroke="#633806" stroke-width="1.5"/>
  <path d="M 380 370 L 402 377 L 380 384 Z" fill="#633806"/>
  <line x1="370" y1="392" x2="240" y2="392" stroke="#6B6B6B" stroke-width="1" opacity="0.7"/>
  <text x="40" y="376" font-size="12" font-weight="500" fill="#854F0B">STAGE 2</text>
  <text x="40" y="394" font-size="14" font-weight="500" fill="#1a1a1a">Fine-tuning</text>
  <text x="40" y="412" font-size="12" fill="#3a3a3a">Curated examples,</text>
  <text x="40" y="428" font-size="12" fill="#3a3a3a">narrow tasks</text>

  <!-- Camp 3 -->
  <circle cx="396" cy="290" r="5" fill="#633806"/>
  <line x1="396" y1="290" x2="396" y2="270" stroke="#633806" stroke-width="1.5"/>
  <path d="M 396 270 L 418 277 L 396 284 Z" fill="#633806"/>
  <line x1="404" y1="288" x2="520" y2="252" stroke="#6B6B6B" stroke-width="1" opacity="0.7"/>
  <text x="530" y="240" font-size="12" font-weight="500" fill="#854F0B">STAGE 3</text>
  <text x="530" y="258" font-size="14" font-weight="500" fill="#1a1a1a">RLHF</text>
  <text x="530" y="276" font-size="12" fill="#3a3a3a">Shape behaviour from</text>
  <text x="530" y="292" font-size="12" fill="#3a3a3a">human preference</text>
</svg>
`.trim();

const RIVER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 440" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>Confluence</title>
  <desc>Three sources merging into one downstream feed</desc>

  <!-- Stream 1 (blue) — top left -->
  <path d="M 60 110 Q 200 110, 280 180 T 396 240" fill="none" stroke="#185FA5" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
  <path d="M 60 110 Q 200 110, 280 180 T 396 240" fill="none" stroke="#185FA5" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Stream 2 (amber) — middle left -->
  <path d="M 60 240 Q 200 240, 296 240 T 396 240" fill="none" stroke="#854F0B" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
  <path d="M 60 240 Q 200 240, 296 240 T 396 240" fill="none" stroke="#854F0B" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Stream 3 (purple) — bottom left -->
  <path d="M 60 360 Q 200 340, 290 300 T 396 240" fill="none" stroke="#534AB7" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
  <path d="M 60 360 Q 200 340, 290 300 T 396 240" fill="none" stroke="#534AB7" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Confluence node -->
  <circle cx="396" cy="240" r="14" fill="#fafaf7" stroke="#1a1a1a" stroke-width="1.5"/>

  <!-- Merged river -->
  <path d="M 410 240 L 600 240" fill="none" stroke="#1a1a1a" stroke-width="14" stroke-linecap="round" opacity="0.25"/>
  <path d="M 410 240 L 600 240" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>
  <path d="M 596 230 L 622 240 L 596 250 Z" fill="#1a1a1a"/>

  <!-- Source labels -->
  <text x="40" y="90" font-size="14" font-weight="500" fill="#0C447C">Webhooks</text>
  <text x="40" y="106" font-size="12" fill="#3a3a3a">Real-time events</text>

  <text x="40" y="220" font-size="14" font-weight="500" fill="#633806">Database CDC</text>
  <text x="40" y="236" font-size="12" fill="#3a3a3a">Row-level changes</text>

  <text x="40" y="340" font-size="14" font-weight="500" fill="#3C3489">Batch jobs</text>
  <text x="40" y="356" font-size="12" fill="#3a3a3a">Nightly snapshots</text>

  <!-- Output label -->
  <text x="640" y="220" font-size="14" font-weight="500" fill="#1a1a1a" text-anchor="end">Unified feed</text>
  <text x="640" y="236" font-size="12" fill="#3a3a3a" text-anchor="end">→ downstream consumers</text>
</svg>
`.trim();

const PHONE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif">
  <title>From tap to confirmation</title>
  <desc>Four moments in a chat send</desc>

  <!-- Phone outline -->
  <rect x="430" y="40" width="180" height="400" rx="22" ry="22" fill="#ffffff" stroke="#1a1a1a" stroke-width="1.5"/>
  <!-- Notch -->
  <rect x="488" y="48" width="64" height="14" rx="7" ry="7" fill="#1a1a1a"/>
  <!-- Screen -->
  <rect x="440" y="72" width="160" height="356" rx="4" ry="4" fill="#fafaf7" stroke="#e3e1d8" stroke-width="1"/>

  <!-- App header -->
  <rect x="440" y="72" width="160" height="34" fill="#1F97DC"/>
  <text x="520" y="93" font-size="12" font-weight="500" fill="#ffffff" text-anchor="middle">Chat</text>

  <!-- Incoming bubble -->
  <rect x="452" y="124" width="100" height="40" rx="14" ry="14" fill="#F1EFE8"/>
  <text x="460" y="149" font-size="12" fill="#1a1a1a">Hi there!</text>

  <!-- Sent bubble (the moment) -->
  <rect x="488" y="190" width="100" height="40" rx="14" ry="14" fill="#E2F0FB" stroke="#1F97DC" stroke-width="1"/>
  <text x="500" y="215" font-size="12" fill="#0D5786">Hello back!</text>

  <!-- Composer -->
  <rect x="448" y="378" width="108" height="36" rx="18" ry="18" fill="#ffffff" stroke="#e3e1d8" stroke-width="1"/>
  <text x="464" y="400" font-size="12" fill="#6b6b6b">Type a message…</text>
  <circle cx="578" cy="396" r="16" fill="#1F97DC"/>
  <path d="M 571 396 L 583 396 M 579 391 L 583 396 L 579 401" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Numbered targets on phone -->
  <circle cx="578" cy="396" r="11" fill="#0D5786"/>
  <text x="578" y="400" font-size="12" font-weight="500" fill="#ffffff" text-anchor="middle">1</text>

  <circle cx="416" cy="278" r="11" fill="#0D5786"/>
  <text x="416" y="282" font-size="12" font-weight="500" fill="#ffffff" text-anchor="middle">2</text>

  <circle cx="416" cy="338" r="11" fill="#0D5786"/>
  <text x="416" y="342" font-size="12" font-weight="500" fill="#ffffff" text-anchor="middle">3</text>

  <circle cx="476" cy="210" r="11" fill="#0D5786"/>
  <text x="476" y="214" font-size="12" font-weight="500" fill="#ffffff" text-anchor="middle">4</text>

  <!-- Callouts (left column) -->
  <text x="40" y="80" font-size="12" font-weight="500" fill="#0D5786">1 · TAP</text>
  <text x="40" y="98" font-size="14" font-weight="500" fill="#1a1a1a">UI captures the press</text>
  <text x="40" y="116" font-size="12" fill="#3a3a3a">Handler runs on the main</text>
  <text x="40" y="132" font-size="12" fill="#3a3a3a">thread, builds a payload</text>

  <text x="40" y="172" font-size="12" font-weight="500" fill="#0D5786">2 · TRANSIT</text>
  <text x="40" y="190" font-size="14" font-weight="500" fill="#1a1a1a">Sent over the network</text>
  <text x="40" y="208" font-size="12" fill="#3a3a3a">Encrypted, queued, retried</text>
  <text x="40" y="224" font-size="12" fill="#3a3a3a">if the link is flaky</text>

  <text x="40" y="264" font-size="12" font-weight="500" fill="#0D5786">3 · STORE</text>
  <text x="40" y="282" font-size="14" font-weight="500" fill="#1a1a1a">Server commits the row</text>
  <text x="40" y="300" font-size="12" fill="#3a3a3a">Writes to the DB, fans out</text>
  <text x="40" y="316" font-size="12" fill="#3a3a3a">to other participants</text>

  <text x="40" y="356" font-size="12" font-weight="500" fill="#0D5786">4 · CONFIRM</text>
  <text x="40" y="374" font-size="14" font-weight="500" fill="#1a1a1a">UI updates the bubble</text>
  <text x="40" y="392" font-size="12" fill="#3a3a3a">"Sending" flips to "sent"</text>
  <text x="40" y="408" font-size="12" fill="#3a3a3a">when the ack lands</text>

  <!-- Leader lines (faint) -->
  <line x1="240" y1="92" x2="566" y2="396" stroke="#0D5786" stroke-width="1" opacity="0.25"/>
  <line x1="240" y1="184" x2="406" y2="278" stroke="#0D5786" stroke-width="1" opacity="0.25"/>
  <line x1="240" y1="276" x2="406" y2="338" stroke="#0D5786" stroke-width="1" opacity="0.25"/>
  <line x1="240" y1="368" x2="466" y2="210" stroke="#0D5786" stroke-width="1" opacity="0.25"/>
</svg>
`.trim();

const SAMPLES: Array<{
  styleName: string;
  topic: string;
  note: string;
  svg: string;
}> = [
  {
    styleName: "Metaphor · iceberg",
    topic: "What users see vs what it took to build",
    note: "Duality. Best when the article contrasts surface and depth.",
    svg: ICEBERG_SVG,
  },
  {
    styleName: "Metaphor · mountain",
    topic: "Three stages of training an LLM",
    note: "Sequential journey. Best when the article is about a multi-step ascent toward a goal.",
    svg: MOUNTAIN_SVG,
  },
  {
    styleName: "Metaphor · confluence",
    topic: "Sources merging into a unified feed",
    note: "Many-to-one. Best when the article describes aggregation, fan-in, or composition.",
    svg: RIVER_SVG,
  },
  {
    styleName: "Annotated hero · device",
    topic: "What happens when you tap send",
    note: "One concrete subject, numbered callouts. Best when the article walks through a concrete object or interface.",
    svg: PHONE_SVG,
  },
];

export default function SamplesPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-12">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Style calibration · not in production
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink">
          Storytelling diagram samples
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
          Four hand-drafted SVGs in the two styles we discussed —{" "}
          <span className="text-ink">metaphor scenes</span> (iceberg, mountain,
          confluence) and{" "}
          <span className="text-ink">annotated hero</span> (one concrete subject
          with numbered callouts). These are the quality target, not generator
          output yet. If the look lands, the next step is to rewrite the planner
          to pick from these recipes and demote flowcharts to a fallback.
        </p>
      </header>

      <div className="space-y-16">
        {SAMPLES.map((s) => (
          <section key={s.styleName}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium uppercase tracking-wider text-accent">
                {s.styleName}
              </span>
              <span className="text-xs text-ink-muted">680 × auto</span>
            </div>
            <h2 className="mb-2 text-lg font-medium text-ink">{s.topic}</h2>
            <p className="mb-5 max-w-2xl text-sm text-ink-muted">{s.note}</p>
            <div
              className="rounded-xl border border-paper-line bg-paper p-6"
              dangerouslySetInnerHTML={{ __html: s.svg }}
            />
          </section>
        ))}
      </div>

      <footer className="mt-20 border-t border-paper-line pt-8 text-sm text-ink-muted">
        <p>
          Tell me which feel right and which feel off — naming the worst one is
          more useful than naming the best. Then I'll wire the planner to pick
          from the surviving recipes.
        </p>
      </footer>
    </main>
  );
}
