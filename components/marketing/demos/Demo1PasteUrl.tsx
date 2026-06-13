"use client";

import { DemoFrame, Fade, between, useDemoTick } from "./demoPrim";

const FULL_URL = "stripe.com/blog/dependency-injection-in-go";
const CYCLE_MS = 9000;

// Timeline (ms):
//   0    – 1500   Browser visible, URL bar idle
//   1500 – 2400   URL bar selection highlights
//   2400 – 3400   "Copied" toast flashes
//   3400 – 4200   Browser fades out, Readopp fades in
//   4200 – 6500   URL types into Readopp input
//   6500 – 7800   Explain button pulses
//   7800 – 8800   Hold
//   8800 – 9000   Reset

export function Demo1PasteUrl() {
  const t = useDemoTick(CYCLE_MS);

  const showBrowser = t < 4000;
  const showReadopp = t >= 3800;
  const selecting = between(t, 1500, 2400);
  const copiedToast = between(t, 2400, 3400);

  // Typing animation: URL chars revealed proportionally between 4200..6300
  const typingStart = 4400;
  const typingEnd = 6300;
  const typingFrac = Math.min(
    1,
    Math.max(0, (t - typingStart) / (typingEnd - typingStart))
  );
  const typedChars = Math.round(FULL_URL.length * typingFrac);
  const typedText = FULL_URL.slice(0, typedChars);
  const cursorVisible = typingFrac < 1 && Math.floor(t / 250) % 2 === 0;

  const explainPulse = between(t, 6600, 7700);

  return (
    <DemoFrame label="Source → Readopp">
      <div className="relative h-[260px] sm:h-[280px]">
        {/* Browser layer */}
        <div
          className={
            "absolute inset-0 transition-opacity duration-500 " +
            (showBrowser ? "opacity-100" : "pointer-events-none opacity-0")
          }
        >
          <BrowserMock url={FULL_URL} selecting={selecting} />
          {/* Copied toast floats above */}
          <div
            className={
              "absolute right-4 top-12 transform transition-all duration-300 " +
              (copiedToast
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-1 opacity-0")
            }
          >
            <div className="flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-paper shadow-md">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 6.5 L5 9.5 L10.5 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Copied
            </div>
          </div>
        </div>

        {/* Readopp layer */}
        <Fade
          show={showReadopp}
          className="absolute inset-0"
          durationMs={400}
        >
          <ReadoppMock
            typedText={typedText}
            cursorVisible={cursorVisible}
            explainPulse={explainPulse}
            ready={typingFrac >= 1}
          />
        </Fade>
      </div>
    </DemoFrame>
  );
}

function BrowserMock({ url, selecting }: { url: string; selecting: boolean }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-paper-line bg-paper-soft px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ED6A5E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F5BD4F]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#62C554]" />
        <div className="ml-2 flex flex-1 items-center gap-2 rounded-md border border-paper-line bg-surface px-2 py-1">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M4 1 a3 3 0 1 0 0.01 0 M6.5 6.5 L9 9"
              fill="none"
              stroke="#6b6b6b"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
          <span
            className={
              "truncate font-mono text-[11px] sm:text-xs " +
              (selecting
                ? "rounded-sm bg-sky/30 px-0.5 text-ink"
                : "text-ink-soft")
            }
          >
            {url}
          </span>
        </div>
      </div>
      {/* Article body */}
      <div className="flex-1 overflow-hidden px-5 py-4">
        <div className="space-y-3">
          <div className="h-3 w-3/5 rounded-sm bg-ink/85" />
          <div className="h-2 w-2/5 rounded-sm bg-ink/30" />
          <div className="space-y-1.5 pt-2">
            <div className="h-1.5 w-full rounded-sm bg-ink/15" />
            <div className="h-1.5 w-[92%] rounded-sm bg-ink/15" />
            <div className="h-1.5 w-[85%] rounded-sm bg-ink/15" />
            <div className="h-1.5 w-[78%] rounded-sm bg-ink/15" />
          </div>
          <div className="space-y-1.5 pt-2">
            <div className="h-1.5 w-[88%] rounded-sm bg-ink/15" />
            <div className="h-1.5 w-[95%] rounded-sm bg-ink/15" />
            <div className="h-1.5 w-[80%] rounded-sm bg-ink/15" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadoppMock({
  typedText,
  cursorVisible,
  explainPulse,
  ready,
}: {
  typedText: string;
  cursorVisible: boolean;
  explainPulse: boolean;
  ready: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-paper p-5">
      <div className="mb-1.5 text-[11px] font-medium text-ink-soft">
        Article URL
      </div>
      <div className="flex items-center gap-2 rounded-md border border-paper-line bg-surface px-3 py-2.5">
        <span className="font-mono text-xs text-ink sm:text-sm">
          {typedText || (
            <span className="text-ink-faint">
              https://example.com/some-article
            </span>
          )}
          {cursorVisible && (
            <span className="ml-px inline-block h-3 w-px translate-y-px bg-ink align-middle" />
          )}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {["General", "Student", "Professional", "Technical"].map((label, i) => (
          <div
            key={label}
            className={
              "rounded-md border px-2 py-1 text-center text-[10px] sm:text-xs " +
              (i === 0
                ? "border-sky bg-sky text-white"
                : "border-paper-line bg-surface text-ink-muted")
            }
          >
            {label}
          </div>
        ))}
      </div>

      <button
        type="button"
        className={
          "mt-auto rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-300 " +
          (ready
            ? "bg-sky text-white " +
              (explainPulse
                ? "shadow-[0_0_0_4px_rgb(var(--c-sky)/0.25)]"
                : "")
            : "bg-ink-faint text-paper opacity-70")
        }
      >
        Explain
      </button>
    </div>
  );
}
