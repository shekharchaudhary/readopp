import { Demo1PasteUrl } from "./demos/Demo1PasteUrl";
import { Demo2AgentsWork } from "./demos/Demo2AgentsWork";
import { Demo3PanelsCompose } from "./demos/Demo3PanelsCompose";
import { Demo4Share } from "./demos/Demo4Share";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

const STEPS: Array<{
  n: string;
  title: string;
  body: string;
  demo: React.ReactNode;
}> = [
  {
    n: "01",
    title: "Paste a URL",
    body: "Any article — a technical blog post, a research paper, a launch announcement, a long newsletter. Copy the URL, paste it here, and we strip away the chrome.",
    demo: <Demo1PasteUrl />,
  },
  {
    n: "02",
    title: "Six agents read it",
    body: "Read, Understand, Outline, Plan, Draw, Assemble. Each agent does one job; you watch them step through their work in real time, with a transcript of every decision.",
    demo: <Demo2AgentsWork />,
  },
  {
    n: "03",
    title: "Panels compose themselves",
    body: "The planner picks the right metaphor for each section — iceberg, mountain, stat callout, bridge. The renderer draws the panel from a deterministic template; no generic flowcharts.",
    demo: <Demo3PanelsCompose />,
  },
  {
    n: "04",
    title: "Share it anywhere",
    body: "Export as a square for Instagram, vertical for TikTok or Reels, landscape for LinkedIn. Every frame carries a QR back to the live, editable explainer.",
    demo: <Demo4Share />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-paper-line bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-28 sm:py-36">
        <Reveal>
          <SectionLabel number="02" title="How it works" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl text-3xl font-medium leading-[1.12] tracking-tight text-ink sm:text-4xl">
            A team of agents, not a single prompt.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Readopp doesn&rsquo;t ask one model to do everything. The work
            splits into six small, observable steps — so you can see what&rsquo;s
            happening, and trust the output.
          </p>
        </Reveal>

        <ol className="mt-16 divide-y divide-paper-line border-y border-paper-line">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delayMs={i * 60}>
              <li className="grid gap-6 py-10 lg:grid-cols-[60px_minmax(0,1fr)_minmax(0,460px)] lg:gap-10 lg:py-14">
                <div className="font-mono text-base font-medium tabular-nums text-accent lg:text-lg">
                  {step.n}
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </div>
                <div className="lg:max-w-[460px]">{step.demo}</div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
