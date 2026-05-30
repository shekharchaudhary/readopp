# Product Spec

## The problem

People save articles they never read. Dense technical writing locks out non-experts. Creators want to turn what they read into shareable content but lack design skills. Existing AI visual tools (Napkin, ConceptViz, Mapify) either (a) only visualize text fragments you paste rather than comprehending a whole article from a URL, (b) produce mediocre/garbled output because they generate images, or (c) hide the AI behind a spinner with no sense of how the result was built.

## The solution

Lucidread takes a URL and an audience level, runs a visible multi-agent pipeline, and produces a clean, vector-rendered visual explainer that can be exported for social media.

## Primary user personas

1. **The learner** — wants to understand a hard article without reading 3000 words. Picks `general` or `student`.
2. **The creator** — runs a newsletter / TikTok / LinkedIn and wants to turn articles into branded visual posts. Cares most about export.
3. **The professional** — wants a fast structured grasp of an industry article to share with a team. Picks `professional`.

## User stories (v1)

- As a user, I can paste any public article URL and pick an audience level, then press "Explain."
- As a user, I watch a live scene where each agent activates in sequence, shows what it's doing, and hands off — so I trust and enjoy the process.
- As a user, I see visual panels stream in one by one as they're rendered, each with a short caption, building into a complete explainer.
- As a user, when it's done, I see the full explainer: a title, a one-line summary, and an ordered series of visual panels with prose between them.
- As a user, I can export any single panel OR the whole explainer as an image in three formats: square (1080×1080, Instagram feed), vertical (1080×1920, TikTok/Reels/Stories), landscape (1200×627, LinkedIn).
- As a user, I can copy a shareable link to the finished explainer.
- As a user, if an article can't be fetched (paywall, login wall, 404), I get a clear, friendly error explaining why and what to try.

## User stories (v2 — note, do not build in v1)

- Save explainers to a personal library.
- Branded export (upload logo + brand colors applied to panels).
- Animated/video export (panels as an MP4 reel with transitions).
- Batch mode (drop 5 URLs, get 5 explainers).
- Browser extension ("Explain this page").

## Screens

### 1. Home / input
- Big URL input, audience-level selector (4 options as tappable pills), "Explain" button.
- Below: 2–3 example explainers as social proof (precomputed, cached).

### 2. Working scene (the centerpiece)
- A horizontal or vertical "pipeline" of 6 agent nodes.
- Current agent is highlighted/animated; completed agents show a check + a one-line result summary; pending agents are dimmed.
- A live log line under the pipeline ("Comprehension agent: identified 2 core failure modes…").
- As render completes, panels begin appearing below the scene.
- See `architecture/FRONTEND_SPEC.md` for exact animation behavior.

### 3. Result / explainer
- Title + summary at top.
- Ordered panels, each: the SVG/HTML visual + caption prose beneath.
- Per-panel "Export" button → format picker (square / vertical / landscape).
- Top-right: "Export all" and "Copy link."

### 4. Error state
- Friendly message keyed to failure reason (see `DATA_CONTRACTS.md` → `JobError.reason`).

## Non-goals (v1)

- No accounts/auth required to run a job (anonymous jobs, link-shareable).
- No editing of the AI's visuals by hand. (Regenerate, don't hand-edit, in v1.)
- No PDF/PPT export in v1 — social image formats only.
- No video export in v1.

## Success criteria for v1

- A clean technical blog post (e.g. an engineering blog) produces a 3–5 panel explainer a non-technical person can follow.
- Total job time under 90 seconds on average.
- Exported square image looks good enough to post without editing.
- The working scene is genuinely fun to watch (qualitative — test on 5 people).
