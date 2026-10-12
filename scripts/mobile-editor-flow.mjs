/**
 * Disposable mobile product-flow check:
 * source upload → generated panels → suggested layout → exact-panel canvas
 * → add editable text → save → return to the same panel.
 *
 * It creates its own anonymous user and deletes the exact explainer/job rows
 * in a finally block. Existing library content is never queried or changed.
 *
 * Run with the local app already listening on port 3000:
 *   npm run e2e:mobile-editor
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "tmp", "e2e-mobile-editor");
const FIXTURE_TITLE = "Designing calmer collaboration";

mkdirSync(OUT, { recursive: true });

let jobId = null;
let explainerId = null;
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, name) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
}

async function cleanup() {
  if (!jobId && !explainerId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("cleanup skipped: Supabase admin environment is unavailable");
    return;
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (explainerId) {
    const { data } = await admin
      .from("explainers")
      .select("id,job_id,title")
      .eq("id", explainerId)
      .maybeSingle();
    assert(
      !data || (data.job_id === jobId && data.title === FIXTURE_TITLE),
      `refusing cleanup: explainer ${explainerId} did not match this fixture`
    );
    if (data) {
      const { error } = await admin.from("explainers").delete().eq("id", explainerId);
      if (error) throw error;
    }
  }

  if (jobId) {
    const { data } = await admin
      .from("jobs")
      .select("id,url")
      .eq("id", jobId)
      .maybeSingle();
    assert(
      !data || data.url === "fixture://mobile-editor",
      `refusing cleanup: job ${jobId} did not match this fixture`
    );
    if (data) {
      const { error } = await admin.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
    }
  }
}

async function cleanupInterruptedJob(id) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && key, "Supabase admin environment is required for cleanup");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("jobs")
    .select("id,url,explainer_id,explainer")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  assert(data, `cleanup job ${id} was not found`);
  assert(
    data.url === "fixture://mobile-editor" &&
      data.explainer?.title === FIXTURE_TITLE,
    `refusing cleanup: job ${id} did not match the mobile fixture`
  );
  jobId = data.id;
  explainerId = data.explainer_id;
  await cleanup();
  console.log(`✓ cleaned interrupted fixture ${id}`);
}

async function main() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  console.log("→ mobile home");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign in" }).waitFor();
  await screenshot(page, "01-home.png");

  console.log("→ verify source chooser and optional brief");
  const googleDocsButton = page
    .locator('button[aria-expanded]')
    .filter({ hasText: "Google Docs" });
  await googleDocsButton.click();
  const workspaceInput = page.getByLabel("Shared Google Docs link");
  await workspaceInput.fill("https://example.com/not-a-google-document");
  await page.getByRole("button", { name: "Create from document" }).click();
  await page
    .getByRole("alert")
    .getByText("Paste a Google Docs document link from docs.google.com.")
    .waitFor();
  await page.getByRole("button", { name: "Close document link form" }).click();

  const notionButton = page
    .locator('button[aria-expanded]')
    .filter({ hasText: "Notion" });
  await notionButton.click();
  const notionInput = page.getByLabel("Shared Notion link");
  await notionInput.fill("https://workspace.notion.site/readopp-source-123");
  assert(
    (await notionInput.inputValue()).includes("notion.site"),
    "Notion source form did not retain the shared document link"
  );
  await page.getByRole("button", { name: "Close document link form" }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "unsupported.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("heading,value\nOne,1"),
  });
  await page
    .getByRole("alert")
    .getByText("Upload a PDF, Word (.docx), Markdown, or text document.")
    .waitFor();

  await page.getByText("Adjust the brief", { exact: false }).click();
  const discussGoal = page.getByRole("button", { name: "Discuss", exact: true });
  const technicalAudience = page.getByRole("button", { name: "Technical", exact: true });
  const boldStyle = page.getByRole("button", { name: "Bold", exact: true });
  await discussGoal.click();
  await technicalAudience.click();
  await boldStyle.click();
  assert((await discussGoal.getAttribute("aria-pressed")) === "true", "publishing goal did not update");
  assert((await technicalAudience.getAttribute("aria-pressed")) === "true", "audience did not update");
  assert((await boldStyle.getAttribute("aria-pressed")) === "true", "visual brief did not update");
  await page.screenshot({ path: join(OUT, "01a-source-brief.png"), fullPage: true });

  console.log("→ review a source-specific story angle and dynamic panel count");
  const briefFixtureResponse = await page.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    {
      headers: { "x-readopp-e2e": "mobile-editor-flow-v1" },
      data: { stage: "brief" },
    }
  );
  assert(
    briefFixtureResponse.status() === 201,
    `brief fixture creation failed (${briefFixtureResponse.status()}): ${await briefFixtureResponse.text()}`
  );
  const briefFixture = await briefFixtureResponse.json();
  jobId = briefFixture.jobId;
  await page.goto(`${BASE}/j/${jobId}`, { waitUntil: "domcontentloaded" });
  const briefReview = page.getByText("We found the strongest angle", { exact: true });
  await briefReview.waitFor({ state: "visible", timeout: 30_000 });
  const storyLengthCard = page.getByRole("group", {
    name: "Story length",
    exact: true,
  });
  await storyLengthCard.waitFor({ state: "visible" });
  assert(
    (await storyLengthCard.textContent())?.includes("We recommend 2–3 panels") &&
      (await storyLengthCard.textContent())?.includes(
        "This short source needs one focused story arc."
      ),
    "the dynamic story-length recommendation is not explained"
  );
  const storyLengthOptions = page.getByRole("group", {
    name: "Choose story length",
  });
  const autoLength = storyLengthOptions.getByRole("button", { name: "Auto" });
  assert(
    (await autoLength.getAttribute("aria-pressed")) === "true",
    "source-aware story length should be the default"
  );
  const fourPanels = storyLengthOptions.getByRole("button", { name: "4 panels" });
  await fourPanels.click();
  assert(
    (await fourPanels.getAttribute("aria-pressed")) === "true",
    "an exact panel count could not override the recommendation"
  );
  const selectedStoryDirection = page.getByTestId("selected-story-direction");
  await selectedStoryDirection.waitFor({ state: "visible" });
  assert(
    (await page.getByText("Protect difficult work without making collaboration disappear.", { exact: true }).count()) === 1,
    "selected story hook should appear once in the concise review"
  );
  const compareAnglesButton = page.getByRole("button", {
    name: "Compare other angles or edit the wording",
  });
  await compareAnglesButton.click();
  await selectedStoryDirection.waitFor({ state: "hidden" });
  const evidenceDirection = page.getByRole("button", {
    name: "Choose Evidence first direction",
  });
  await evidenceDirection.click();
  assert(
    (await evidenceDirection.getAttribute("aria-pressed")) === "true",
    "story angle did not switch before production"
  );
  assert(
    (await evidenceDirection.getAttribute("class"))?.includes("border-accent"),
    "selected story angle did not receive the active visual state"
  );
  const openingHook = page.getByLabel("Opening hook");
  await openingHook.fill(
    "Every interruption spends capacity the team cannot recover immediately."
  );
  assert(
    (await openingHook.inputValue()).startsWith("Every interruption"),
    "opening hook could not be refined before production"
  );
  await page.getByRole("button", { name: "Done comparing" }).click();
  await selectedStoryDirection.waitFor({ state: "visible" });
  await page
    .getByText(
      "Every interruption spends capacity the team cannot recover immediately.",
      { exact: true }
    )
    .waitFor();
  await screenshot(page, "01b-story-review.png");
  await compareAnglesButton.click();
  assert(
    (await openingHook.inputValue()).startsWith("Every interruption"),
    "edited opening hook was not preserved after collapsing the options"
  );
  const createStoryButton = page.getByRole("button", {
    name: "Create this story →",
  });
  const [angleBox, createBox] = await Promise.all([
    page.getByLabel("Narrative angle").boundingBox(),
    createStoryButton.boundingBox(),
  ]);
  assert(
    angleBox && createBox && createBox.y > angleBox.y + angleBox.height,
    "create action should follow the final editable brief field"
  );
  await cleanup();
  jobId = null;
  explainerId = null;

  console.log("→ create isolated development fixture");
  const fixtureResponse = await page.request.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    {
      headers: { "x-readopp-e2e": "mobile-editor-flow-v1" },
    }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture creation failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  explainerId = fixture.explainerId;
  assert(jobId && explainerId, "fixture did not return job and explainer ids");
  await page.goto(
    fixture.eventEmitted ? `${BASE}/j/${jobId}` : `${BASE}/e/${explainerId}`,
    {
      // The job view intentionally holds an SSE connection open, so
      // `networkidle` is not a meaningful readiness signal on this route.
      waitUntil: "domcontentloaded",
    }
  );
  await screenshot(page, "02-created.png");

  console.log("→ wait for generated, editable panels");
  const layoutsButton = page.locator('button[aria-controls^="panel-layout-picker-"]').first();
  await layoutsButton.waitFor({ state: "visible", timeout: 360_000 });
  const mobileFirstPanel = page.locator('[data-testid^="panel-card-"]').first();
  const mobilePanelActions = [
    layoutsButton,
    mobileFirstPanel.getByRole("button", { name: "Regenerate", exact: true }),
    mobileFirstPanel.getByRole("link", { name: "Customize canvas", exact: true }),
    mobileFirstPanel.getByRole("button", { name: "More panel actions" }),
  ];
  for (const action of mobilePanelActions) {
    const actionBox = await action.boundingBox();
    assert(
      actionBox && actionBox.height >= 32,
      `mobile panel action is too short for reliable touch input (${actionBox?.height}px)`
    );
  }
  const mobileAddPanel = page.getByRole("button", { name: "Add panel below" }).first();
  const mobileAddBox = await mobileAddPanel.boundingBox();
  const mobileAddOpacity = Number(
    await mobileAddPanel.evaluate((element) => getComputedStyle(element).opacity)
  );
  assert(mobileAddBox && mobileAddBox.height >= 32, "mobile add-panel target is too small");
  assert(mobileAddOpacity >= 0.5, "mobile add-panel action is not visibly discoverable");
  await screenshot(page, "03-panels.png");

  console.log("→ verify touch-sized panel regeneration guidance");
  await mobileFirstPanel.getByRole("button", { name: "Regenerate", exact: true }).click();
  const mobileRegenerateDialog = page.getByTestId("panel-regenerate-dialog");
  await mobileRegenerateDialog.waitFor({ state: "visible" });
  const mobileRegenerateBox = await mobileRegenerateDialog.boundingBox();
  assert(mobileRegenerateBox, "mobile regeneration dialog has no measurable box");
  assert(
    mobileRegenerateBox.x >= 12 && mobileRegenerateBox.x + mobileRegenerateBox.width <= 378,
    "mobile regeneration dialog escapes the viewport"
  );
  await mobileRegenerateDialog
    .getByRole("button", { name: "Shorten the copy and sharpen the takeaway" })
    .waitFor({ state: "visible" });
  await screenshot(page, "03a-regenerate.png");
  await mobileRegenerateDialog
    .getByRole("button", { name: "Keep current panel" })
    .click();
  await mobileRegenerateDialog.waitFor({ state: "hidden" });

  console.log("→ verify mobile suggestion sheet and apply another layout");
  await layoutsButton.click();
  const sheet = page.getByTestId("layout-picker-sheet");
  await sheet.waitFor({ state: "visible" });
  assert(
    await page.getByTestId("layout-picker-backdrop").isVisible(),
    "mobile layout picker did not isolate the active decision with a backdrop"
  );
  const sheetBox = await sheet.boundingBox();
  assert(sheetBox, "layout suggestion sheet has no measurable box");
  assert(sheetBox.x >= 12, `layout sheet escapes left viewport (${sheetBox.x})`);
  assert(
    sheetBox.x + sheetBox.width <= 378,
    `layout sheet escapes right viewport (${sheetBox.x + sheetBox.width})`
  );
  await sheet.getByText("Matched from", { exact: true }).waitFor();
  await sheet.getByTestId("layout-automatic-state").waitFor();
  await sheet
    .locator('[data-layout-preview-state="ready"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await screenshot(page, "03b-layout-suggestions.png");
  const alternate = sheet.locator('button[data-layout-id]:not([aria-pressed="true"]):not([disabled])').first();
  const chosenLayout = await alternate.getAttribute("data-layout-id");
  assert(chosenLayout, "no compatible alternate layout was offered");
  await alternate.click();
  await sheet.waitFor({ state: "hidden" });
  await page.getByTestId("layout-applied-status").first().waitFor({ state: "attached" });
  assert(
    (await layoutsButton.getAttribute("aria-label"))?.startsWith("Change panel layout. Current layout:"),
    "mobile layout trigger does not expose the active composition"
  );
  await screenshot(page, "04-layout-applied.png");

  console.log(`→ open ${chosenLayout} in the exact-panel canvas`);
  const firstPanel = page.locator('[data-testid^="panel-card-"]').first();
  const panelTestId = await firstPanel.getAttribute("data-testid");
  const sectionId = panelTestId?.replace("panel-card-", "");
  assert(sectionId, "first panel section id missing");
  await firstPanel.getByRole("link", { name: "Customize canvas" }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), {
    timeout: 60_000,
  });
  const strip = page.getByTestId("canvas-action-strip");
  await strip.waitFor({ state: "visible" });
  await page.getByText("Loading canvas…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  const stripBox = await strip.boundingBox();
  assert(stripBox && stripBox.height <= 72, `mobile canvas actions are too tall (${stripBox?.height}px)`);
  for (const name of ["Canvas tools", "Save panel", "Export PNG", "Done"]) {
    const action = strip.getByRole("button", { name });
    await action.waitFor({ state: "visible" });
    const actionBox = await action.boundingBox();
    assert(actionBox && actionBox.height >= 32, `${name} is too short for reliable touch input`);
  }
  const nextPanelAction = strip.getByRole("button", { name: /Save and edit next panel/ });
  await nextPanelAction.waitFor({ state: "visible" });
  const nextPanelActionBox = await nextPanelAction.boundingBox();
  assert(nextPanelActionBox && nextPanelActionBox.height >= 32, "next-panel control is too short for touch input");
  assert(
    !(await strip.getByRole("button", { name: /Save and edit previous panel/ }).isVisible()),
    "previous-panel control should be absent on the first panel"
  );
  await screenshot(page, "05-canvas.png");

  console.log("→ select and rewrite existing native canvas text");
  const canvas = page.locator("canvas.excalidraw__canvas.interactive:visible");
  await canvas.waitFor({ state: "visible", timeout: 60_000 });
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, "canvas has no measurable box");
  const pointerEvents = await canvas.evaluate(
    (node) => getComputedStyle(node).pointerEvents
  );
  assert(pointerEvents === "auto", "selected canvas layer is not interactive");
  let editSelected = null;
  for (const [xRatio, yRatio] of [
    [0.25, 0.29],
    [0.5, 0.41],
    [0.28, 0.23],
    [0.16, 0.19],
    [0.5, 0.38],
    [0.5, 0.45],
  ]) {
    await page.touchscreen.tap(
      canvasBox.x + canvasBox.width * xRatio,
      canvasBox.y + canvasBox.height * yRatio
    );
    await strip.getByRole("button", { name: "Canvas tools" }).click();
    const candidate = page.getByRole("menuitem", { name: "Edit selected text" });
    if (await candidate.isVisible()) {
      editSelected = candidate;
      break;
    }
    await strip.getByRole("button", { name: "Canvas tools" }).click();
  }
  assert(editSelected, "could not select an existing native text element on mobile");
  await editSelected.click();
  const editComposer = page.getByTestId("canvas-text-composer");
  const editInput = editComposer.getByLabel("Edit selected canvas text");
  await editInput.waitFor({ state: "visible" });
  const editInputMetrics = await editInput.evaluate((element) => ({
    tagName: element.tagName,
    height: element.getBoundingClientRect().height,
  }));
  assert(
    editInputMetrics.tagName === "TEXTAREA" && editInputMetrics.height >= 56,
    "mobile canvas copy editor is not a usable multi-line field"
  );
  const updateTextBox = await editComposer
    .getByRole("button", { name: "Update text" })
    .boundingBox();
  assert(
    updateTextBox && updateTextBox.height >= 32,
    "mobile canvas text update action is too small"
  );
  await screenshot(page, "05a-text-editor.png");
  const originalSelectedText = await editInput.inputValue();
  assert(originalSelectedText.trim(), "selected text composer opened without existing copy");
  await editInput.fill("Mobile-edited existing text");
  await editComposer.getByRole("button", { name: "Update text" }).click();
  await editComposer.waitFor({ state: "hidden" });

  console.log("→ add another editable canvas text block");
  await strip.getByRole("button", { name: "Canvas tools" }).click();
  await page.getByRole("menuitem", { name: "Add text to canvas" }).click();
  const composer = page.getByTestId("canvas-text-composer");
  await composer.waitFor({ state: "visible" });
  await composer.getByLabel("Text to add to this panel").fill("Mobile audit note");
  await composer.getByRole("button", { name: "Add to canvas" }).click();
  await composer.waitFor({ state: "hidden" });

  console.log("→ import editable SVG artwork into the current panel");
  await strip.getByRole("button", { name: "Canvas tools" }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Import artwork or scene" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "mobile-layout.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 180"><rect x="8" y="8" width="404" height="164" rx="18" fill="#EAF5D2" stroke="#111111"/><path d="M42 126 C110 54 200 54 268 126" fill="none" stroke="#1F97DC" stroke-width="8"/><text x="42" y="62" font-family="Arial" font-size="26" fill="#111111">Imported layout marker</text></svg>'
    ),
  });
  const importStatus = page.getByTestId("canvas-import-status");
  await importStatus
    .getByText(/Imported “mobile-layout\.svg” as \d+ editable elements?\./)
    .waitFor();
  await screenshot(page, "05b-imported-artwork.png");

  console.log("→ save the edited panel");
  const committedPanel = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}/panels/${sectionId}`)
  );
  await strip.getByRole("button", { name: "Save panel" }).click();
  await strip
    .locator("span:visible")
    .filter({ hasText: /^Panel saved$/ })
    .waitFor({ timeout: 30_000 });
  const commitResponse = await committedPanel;
  assert(commitResponse.ok(), `panel commit failed (${commitResponse.status()})`);
  const commitPayload = await commitResponse.json();
  const committed = commitPayload.explainer?.panels?.find(
    (panel) => panel.sectionId === sectionId
  );
  assert(committed?.edited === true, "panel commit did not mark the panel edited");
  await screenshot(page, "05c-panel-saved.png");

  const sceneResponse = await page.request.get(
    `${BASE}/api/scenes/${explainerId}/${encodeURIComponent(sectionId)}`
  );
  assert(sceneResponse.ok(), `saved scene request failed (${sceneResponse.status()})`);
  const scenePayload = await sceneResponse.json();
  const serializedScene = JSON.stringify(scenePayload);
  assert(serializedScene.includes("Mobile audit note"), "saved scene did not contain the new editable text");
  assert(
    serializedScene.includes("Mobile-edited existing text"),
    "saved scene did not contain the rewritten native text"
  );
  assert(
    serializedScene.includes("Imported layout marker"),
    "saved scene did not contain the imported editable SVG text"
  );

  console.log("→ move between panels on mobile without leaving the canvas workflow");
  await strip.getByRole("button", { name: /Save and edit next panel/ }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/shared-rhythm$`), {
    timeout: 60_000,
  });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });
  const nextStrip = page.getByTestId("canvas-action-strip");
  await nextStrip.getByRole("button", { name: /Save and edit previous panel/ }).click();
  await page.waitForURL(new RegExp(`/edit/${explainerId}/${sectionId}$`), {
    timeout: 60_000,
  });
  await page.getByTestId("canvas-fitting").waitFor({ state: "hidden", timeout: 60_000 });

  console.log("→ return to the exact panel");
  await page.getByTestId("canvas-action-strip").getByRole("button", { name: "Done" }).click();
  await page.waitForURL(new RegExp(`/e/${explainerId}#panel-${sectionId}$`), {
    timeout: 60_000,
  });
  const returnedPanel = page.getByTestId(`panel-card-${sectionId}`);
  await returnedPanel.waitFor({ state: "visible" });
  await screenshot(page, "06-returned-panel.png");
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();

  console.log("→ verify ranked story-level template recommendations");
  const templatesResponse = await page.request.get(
    `${BASE}/api/templates?explainerId=${encodeURIComponent(explainerId)}`
  );
  assert(templatesResponse.ok(), `template recommendations failed (${templatesResponse.status()})`);
  const templatePayload = await templatesResponse.json();
  const recommendations = templatePayload.templates
    .filter((template) => template.recommendation)
    .sort((a, b) => a.recommendation.rank - b.recommendation.rank);
  assert(recommendations.length === 3, `expected 3 ranked recommendations, got ${recommendations.length}`);
  assert(
    recommendations.every(
      (template, index) =>
        template.recommendation.rank === index + 1 &&
        typeof template.recommendation.signal === "string" &&
        template.recommendation.signal.length >= 20 &&
        typeof template.recommendation.outcome === "string" &&
        template.recommendation.outcome.length >= 20 &&
        typeof template.recommendation.reason === "string" &&
        template.recommendation.reason.length >= 20
    ),
    "template recommendations are missing ordered, content-specific reasons"
  );
  assert(templatePayload.customPanelCount === 1, "custom panel preservation count is incorrect");
  assert(
    templatePayload.previewSectionId !== sectionId,
    "template picker previewed the canvas override instead of a panel that can adopt the identity"
  );
  const alternativeTemplate = recommendations.find(
    (template) => template.id !== "adaptive-editorial" && !template.locked
  );
  assert(alternativeTemplate, "no usable alternate recommended template was offered");

  await page.getByRole("button", { name: /Adaptive Editorial/ }).click();
  const templateDialog = page.getByRole("dialog", { name: "Choose a mature visual direction." });
  await templateDialog.waitFor({ state: "visible" });
  assert(
    (await templateDialog.evaluate((element) => element.scrollTop)) <= 1,
    "mobile template picker did not open at the ranked recommendations"
  );
  await templateDialog
    .getByText("Recommended for this story", { exact: true })
    .waitFor({ state: "visible" });
  await templateDialog
    .getByText(/1 canvas-customized panel will stay exactly as designed/)
    .waitFor();
  for (const recommendation of recommendations) {
    const recommendationCard = templateDialog.locator(
      `[data-template-card-id="${recommendation.id}"]`
    );
    await recommendationCard.waitFor({ state: "visible" });
    await recommendationCard
      .getByTestId("template-recommendation-signal")
      .filter({ hasText: recommendation.recommendation.signal })
      .waitFor();
    await recommendationCard
      .getByTestId("template-recommendation-outcome")
      .filter({ hasText: recommendation.recommendation.outcome })
      .waitFor();
  }
  await page.waitForFunction(
    () => {
      const recommendedCards = Array.from(
        document.querySelectorAll('[data-template-card-id]')
      ).filter((card) => card.querySelector('[data-testid="template-recommendation-signal"]'));
      return (
        recommendedCards.length === 3 &&
        recommendedCards.every(
          (card) =>
            card.querySelector('[data-template-preview-state="ready"]') !== null
        )
      );
    },
    undefined,
    { timeout: 60_000 }
  );
  const recommendationRail = templateDialog.getByTestId("template-card-rail").first();
  const railMetrics = await recommendationRail.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    firstCardWidth:
      element.querySelector('[data-template-card-id]')?.getBoundingClientRect().width ?? 0,
  }));
  assert(
    railMetrics.scrollWidth > railMetrics.clientWidth,
    "mobile recommendations do not expose a swipeable comparison rail"
  );
  assert(
    railMetrics.firstCardWidth > 0 && railMetrics.firstCardWidth <= 320,
    `mobile recommendation card is too wide to reveal alternatives (${railMetrics.firstCardWidth}px)`
  );
  await page.screenshot({ path: join(OUT, "06a-template-recommendations.png") });
  await templateDialog
    .getByTestId("template-recommendation-signal")
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, "06b-template-reason.png") });
  const switchedTemplate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/explainers/${explainerId}`)
  );
  await templateDialog.locator(`button[data-template-id="${alternativeTemplate.id}"]`).click();
  const switchResponse = await switchedTemplate;
  assert(switchResponse.ok(), `template switch failed (${switchResponse.status()})`);
  const switchedPayload = await switchResponse.json();
  assert(
    switchedPayload.explainer?.template === alternativeTemplate.id,
    "template switch response did not persist the selected identity"
  );
  const preservedPanel = switchedPayload.explainer?.panels?.find(
    (panel) => panel.sectionId === sectionId
  );
  assert(
    preservedPanel?.edited === true &&
      String(preservedPanel.content).includes("data-readopp-canvas-override"),
    "switching visual identity did not preserve the customized panel"
  );
  await templateDialog.waitFor({ state: "hidden" });
  const activeTemplateTrigger = page.locator(
    'button[aria-controls="template-picker-dialog"]'
  );
  await activeTemplateTrigger
    .filter({ hasText: alternativeTemplate.name })
    .waitFor({ state: "visible" });
  assert(
    (await activeTemplateTrigger.textContent())?.includes(alternativeTemplate.name),
    "story-level identity label did not update after the rendered direction changed"
  );
  await returnedPanel.getByText("edited", { exact: false }).first().waitFor();
  const templatedPanelCount = switchedPayload.explainer.panels.filter(
    (panel) => !String(panel.content).includes("data-readopp-canvas-override")
  ).length;
  await page.waitForFunction(
    ({ expected }) => {
      const previews = Array.from(
        document.querySelectorAll('[data-testid="templated-panel-preview"]')
      );
      return (
        previews.length >= expected &&
        previews.every((preview) => preview.getAttribute("data-preview-state") === "ready")
      );
    },
    { expected: templatedPanelCount },
    { timeout: 60_000 }
  );
  await page.waitForTimeout(250);
  await screenshot(page, "07-template-switched.png");
  const firstTemplatedPreview = page
    .locator('[data-testid="templated-panel-preview"][data-preview-state="ready"]')
    .first();
  await firstTemplatedPreview.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, "07a-template-panel-ready.png") });

  assert(consoleErrors.length === 0, `browser errors:\n${consoleErrors.join("\n")}`);
  console.log(
    `✓ mobile flow passed (${chosenLayout}; ${sectionId}; ${alternativeTemplate.id})`
  );
  console.log(`  screenshots: ${OUT}`);
}

if (process.argv[2] === "cleanup") {
  assert(process.argv[3], "usage: mobile-editor-flow.mjs cleanup <job-id>");
  await cleanupInterruptedJob(process.argv[3]);
} else {
  try {
    await main();
  } finally {
    await browser?.close();
    await cleanup();
  }
}
