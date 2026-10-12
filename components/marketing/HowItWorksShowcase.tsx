"use client";

import { WorkflowTextRegion, WorkflowRevealText } from "./WorkflowTextEffects";
import { useState } from "react";
import {
  TemplateParallax,
  type WorkflowStep,
} from "@/components/marketing/TemplateParallax";

const WORKFLOW_STEPS: Array<{
  id: WorkflowStep;
  number: string;
  title: string;
  body: string;
}> = [
  {
    id: 1,
    number: "01",
    title: "Add your source",
    body: "Use a public document link or upload a PDF, Word file, or reading notes.",
  },
  {
    id: 2,
    number: "02",
    title: "Shape the story",
    body: "Review the brief, choose your angle, and decide what your audience should take away.",
  },
  {
    id: 3,
    number: "03",
    title: "Make it yours",
    body: "Edit the words and layouts, then export a visual story ready to share.",
  },
];

export function HowItWorksShowcase() {
  const [activeStep, setActiveStep] = useState<WorkflowStep>(3);

  return (
    <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-14">
      <WorkflowTextRegion>
        <p className="text-xs font-bold uppercase tracking-[.15em] landing-green">
          How it works
        </p>
        <h2 data-workflow-ink className="workflow-ink-heading mt-4 text-4xl font-bold leading-none tracking-[-.05em] text-ink sm:text-5xl">
          Your reading.
          <br />
          Your point of view.
        </h2>
        <p data-workflow-ink className="workflow-ink-summary mt-5 text-base leading-7 text-ink-muted">
          Readopp helps you find the story in your source. You choose the message, shape the design, and make the final call.
        </p>
        <ol className="mt-8 divide-y divide-paper-line border-y border-paper-line">
          {WORKFLOW_STEPS.map((step) => {
            const isActive = activeStep === step.id;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`process-step grid w-full grid-cols-[34px_1fr] gap-x-3 gap-y-1 py-5 text-left ${
                    isActive ? "process-step--active" : ""
                  }`}
                  aria-pressed={isActive}
                  onMouseEnter={() => setActiveStep(step.id)}
                  onFocus={() => setActiveStep(step.id)}
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className="process-step__number pt-1 text-xs font-bold landing-green">
                    {step.number}
                  </span>
                  <span className="process-step__title text-lg font-bold tracking-[-.025em] text-ink">
                    <WorkflowRevealText text={step.title} active={isActive} />
                  </span>
                  <span className="process-step__body col-start-2 text-sm leading-6 text-ink-soft">
                    {step.body}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </WorkflowTextRegion>

      <div className="force-light"><TemplateParallax activeStep={activeStep} /></div>
    </div>
  );
}
