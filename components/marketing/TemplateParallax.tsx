"use client";

import { useEffect, useRef } from "react";

export type WorkflowStep = 1 | 2 | 3;

const SCENE_LABELS: Record<WorkflowStep, string> = {
  1: "Importing an article or PDF into Readopp",
  2: "Readopp finding the claim, evidence, and tension in a source",
  3: "Editing a Readopp poster and choosing its color theme",
};

export function TemplateParallax({ activeStep }: { activeStep: WorkflowStep }) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let scrollPosition = 0;

    const render = () => {
      frame = 0;
      stage.style.cssText = [
        `--far-x:${pointerX * -7}px`,
        `--far-y:${pointerY * -5 + scrollPosition * -8}px`,
        `--mid-x:${pointerX * 11}px`,
        `--mid-y:${pointerY * 8 + scrollPosition * 13}px`,
        `--near-x:${pointerX * 18}px`,
        `--near-y:${pointerY * 13 + scrollPosition * 21}px`,
      ].join(";");
    };

    const scheduleRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const updateScroll = () => {
      const rect = stage.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const stageCenter = rect.top + rect.height / 2;
      scrollPosition = Math.max(-1, Math.min(1, (viewportCenter - stageCenter) / window.innerHeight));
      scheduleRender();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      scheduleRender();
    };

    const handlePointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
      scheduleRender();
    };

    updateScroll();
    stage.addEventListener("pointermove", handlePointerMove, { passive: true });
    stage.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  return (
    <div ref={stageRef} className="template-parallax" data-step={activeStep} role="img" aria-label={SCENE_LABELS[activeStep]}>
      <div className="template-layer template-layer--far template-workspace" aria-hidden>
        <WorkspaceBar activeStep={activeStep} />
        <div key={activeStep} className="template-scene">
          {activeStep === 1 ? <SourceScene /> : null}
          {activeStep === 2 ? <StoryScene /> : null}
          {activeStep === 3 ? <EditorScene /> : null}
        </div>
      </div>

      {activeStep === 1 ? <SourcePanel /> : null}
      {activeStep === 2 ? <SignalsPanel /> : null}
      {activeStep === 3 ? <ColorPanel /> : null}

      <div key={`format-${activeStep}`} className="template-layer template-layer--near template-export-panel template-scene" aria-hidden>
        <span>{activeStep === 3 ? "Format" : activeStep === 2 ? "Story shape" : "Source type"}</span>
        <b>{activeStep === 3 ? "LinkedIn carousel" : activeStep === 2 ? "Claim → evidence" : "Article or PDF"}</b>
        <i>{activeStep === 3 ? "⌄" : "✓"}</i>
      </div>

      <div className="template-depth-label" aria-hidden>
        <span className="template-depth-dot" />
        Hover a step to preview the flow
      </div>
    </div>
  );
}

function WorkspaceBar({ activeStep }: { activeStep: WorkflowStep }) {
  return (
    <div className="template-workspace__bar">
      <span /><span /><span />
      <em>{activeStep === 1 ? "New story" : activeStep === 2 ? "Reading the source" : "Visual editor"}</em>
      <div className="template-workspace__tools"><b>T</b><b>□</b><b>↗</b></div>
    </div>
  );
}

function SourceScene() {
  return (
    <div className="template-source-scene">
      <div className="template-source-sidebar">
        <span className="template-source-sidebar__active">01</span><span>02</span><span>03</span>
      </div>
      <div className="template-source-canvas">
        <span className="template-scene-kicker">Start with the source</span>
        <h3>Where does it live?</h3>
        <p>Connect your workspace or bring the document with you.</p>
        <div className="template-source-input"><span>G</span><b>Attention and Deep Work</b><i>Google Docs</i></div>
        <div className="template-upload-row">
          <span>N</span>
          <div><b>My reading notes</b><small>Selected from Notion</small></div>
          <i>Notion</i>
        </div>
        <div className="template-upload-row">
          <span>⇧</span>
          <div><b>Upload document</b><small>PDF · up to 25 MB</small></div>
          <i>Browse</i>
        </div>
      </div>
    </div>
  );
}

function StoryScene() {
  return (
    <div className="template-story-scene">
      <article className="template-source-page">
        <div className="template-source-page__meta"><span>THE SOURCE</span><i>12 min read</i></div>
        <h3>Why protecting attention changes the quality of your work</h3>
        <p>Interruptions do more than take time. They create a residue that follows us into the next task.</p>
        <p className="template-highlight template-highlight--claim">A protected block of focus compounds into clearer decisions.</p>
        <p className="template-highlight template-highlight--proof">It can take 23 minutes to recover after an interruption.</p>
        <p>That makes attention less like a mood and more like infrastructure.</p>
      </article>
      <aside className="template-story-map">
        <span className="template-scene-kicker">Story found</span>
        <h3>Protect the condition, not just the calendar.</h3>
        <dl>
          <div><dt>01</dt><dd><b>Core claim</b><span>Attention compounds</span></dd></div>
          <div><dt>03</dt><dd><b>Evidence points</b><span>Time, capacity, recovery</span></dd></div>
          <div><dt>01</dt><dd><b>Useful tension</b><span>Busy ≠ productive</span></dd></div>
        </dl>
      </aside>
    </div>
  );
}

function EditorScene() {
  return (
    <div className="template-workspace__body">
      <div className="template-thumbnail-rail">
        <div className="template-thumb template-thumb--active"><i /><b>THE<br />RESEARCH</b></div>
        <div className="template-thumb"><i /><b>KEY<br />IDEA</b></div>
        <div className="template-thumb"><i /><b>FIELD<br />NOTE</b></div>
      </div>
      <div className="template-editor-canvas">
        <article className="template-editor-poster">
          <div className="template-editor-poster__meta"><span>THE RESEARCH</span><span>01 / 05</span></div>
          <div className="template-editor-poster__grid">
            <div><p>WHAT THE EVIDENCE SHOWS</p><h3>Attention compounds when you protect it.</h3></div>
            <dl>
              <div><dt>23 min</dt><dd>to recover after an interruption</dd></div>
              <div><dt>40% less</dt><dd>capacity under task switching</dd></div>
              <div><dt>90 min</dt><dd>for meaningful deep work</dd></div>
            </dl>
          </div>
        </article>
        <span className="template-selection-handle template-selection-handle--tl" />
        <span className="template-selection-handle template-selection-handle--tr" />
        <span className="template-selection-handle template-selection-handle--bl" />
        <span className="template-selection-handle template-selection-handle--br" />
      </div>
    </div>
  );
}

function SourcePanel() {
  return (
    <div className="template-layer template-layer--mid template-info-panel template-scene" aria-hidden>
      <span className="template-panel-label">Source ready</span><b>Attention &amp;<br />Deep Work</b>
      <div><i>✓</i><span>Article text found</span></div><div><i>✓</i><span>8 min to process</span></div>
    </div>
  );
}

function SignalsPanel() {
  return (
    <div className="template-layer template-layer--mid template-info-panel template-signals-panel template-scene" aria-hidden>
      <span className="template-panel-label">Story signals</span><b>6 useful ideas</b>
      <div><i className="template-signal-dot template-signal-dot--claim" /><span>Claim</span></div>
      <div><i className="template-signal-dot template-signal-dot--proof" /><span>Evidence</span></div>
      <div><i className="template-signal-dot template-signal-dot--tension" /><span>Tension</span></div>
    </div>
  );
}

function ColorPanel() {
  return (
    <div className="template-layer template-layer--mid template-color-panel template-scene" aria-hidden>
      <div><span>COLORS</span><b>×</b></div><p>ACCENT</p>
      <div className="template-swatches">
        <i /><i /><i /><i /><i /><span className="template-swatch-ring" />
        <div className="template-cursor">
          <span className="template-cursor-ripple" />
          <svg viewBox="0 0 32 38"><path d="M12 19V6a3 3 0 0 1 6 0v9-4a3 3 0 0 1 6 0v6-3a3 3 0 0 1 6 0v8c0 8-4.8 13-12 13h-1.5c-4.2 0-7-2-9.2-5.4l-4.5-6.7a3 3 0 0 1 4.3-4l4.9 4.3V19Z" fill="white" stroke="#484848" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      <p>BACKGROUND</p><div className="template-color-row"><i /><span>#F5F1E9</span></div>
    </div>
  );
}
