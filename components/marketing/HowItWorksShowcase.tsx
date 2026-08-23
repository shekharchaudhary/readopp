"use client";

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
    title: "Bring the source",
    body: "Bring a Google Doc, Notion page, journal entry, or PDF.",
  },
  {
    id: 2,
    number: "02",
    title: "Find the story",
    body: "Readopp identifies the claim, evidence, and useful tension.",
  },
  {
    id: 3,
    number: "03",
    title: "Edit and publish",
    body: "Refine the result, then export it for LinkedIn or X.",
  },
];

export function HowItWorksShowcase() {
  const [activeStep, setActiveStep] = useState<WorkflowStep>(3);

  return (
    <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-14">
      <div className="max-w-[430px]">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-[#7eae3f]">
          How it works
        </p>
        <h2 className="mt-4 text-4xl font-bold leading-none tracking-[-.05em] text-[#484848] sm:text-5xl">
          From reading
          <br />
          to publishing.
        </h2>
        <p className="mt-5 text-base leading-7 text-[#77736c]">
          One source becomes a set of clear, publishable visual stories. Each
          template follows the shape of the idea—not decoration.
        </p>
        <ol className="mt-8 divide-y divide-[#d8d4ca] border-y border-[#d8d4ca]">
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
                  <span className="process-step__number pt-1 text-xs font-bold text-[#7eae3f]">
                    {step.number}
                  </span>
                  <span className="process-step__title text-lg font-bold tracking-[-.025em] text-[#484848]">
                    {step.title}
                  </span>
                  <span className="process-step__body col-start-2 text-sm leading-6 text-[#6d6a64]">
                    {step.body}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <TemplateParallax activeStep={activeStep} />
    </div>
  );
}
