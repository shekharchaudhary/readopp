/**
 * Mixed-carousel parity contract:
 * one canvas override + one template-managed panel → preview HTML → PNG export.
 *
 * The browser screenshots the exact preview response at export dimensions and
 * compares its pixels byte-for-byte with the downloaded product export.
 */
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const EXPORT_DIMENSIONS = {
  square: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 627 },
};
const requestedFormats = process.argv.slice(2);
const formats = requestedFormats.length
  ? requestedFormats.filter((format) => format in EXPORT_DIMENSIONS)
  : Object.keys(EXPORT_DIMENSIONS);

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const FIXTURE_TITLE = "Designing calmer collaboration";
const FIXTURE_URL = "fixture://mobile-editor";
const CUSTOM_MARKER = "Canvas custom parity marker";

let browser;
let jobId;
let explainerId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function cleanup() {
  if (!jobId && !explainerId) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (explainerId) {
    const { data, error } = await admin
      .from("explainers")
      .select("id,job_id,title")
      .eq("id", explainerId)
      .maybeSingle();
    if (error) throw error;
    assert(
      !data || (data.job_id === jobId && data.title === FIXTURE_TITLE),
      `refusing cleanup: explainer ${explainerId} is not this fixture`
    );
    if (data) {
      const { error: deleteError } = await admin
        .from("explainers")
        .delete()
        .eq("id", explainerId);
      if (deleteError) throw deleteError;
    }
  }
  if (jobId) {
    const { data, error } = await admin
      .from("jobs")
      .select("id,url")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    assert(
      !data || data.url === FIXTURE_URL,
      `refusing cleanup: job ${jobId} is not this fixture`
    );
    if (data) {
      const { error: deleteError } = await admin.from("jobs").delete().eq("id", jobId);
      if (deleteError) throw deleteError;
    }
  }
}

async function screenshotHtml(context, html, format) {
  const dimensions = EXPORT_DIMENSIONS[format];
  const page = await context.newPage();
  try {
    await page.setViewportSize(dimensions);
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    return Buffer.from(
      await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, ...dimensions },
      })
    );
  } finally {
    await page.close();
  }
}

async function assertPanelParity(api, renderContext, sectionId, kind, format) {
  const previewResponse = await api.get(
    `${BASE}/api/explainers/${explainerId}/panels/${sectionId}/template-html?format=${format}`
  );
  assert(
    previewResponse.ok(),
    `${kind} preview failed (${previewResponse.status()}): ${await previewResponse.text()}`
  );
  const previewHtml = await previewResponse.text();
  if (kind === "custom") {
    assert(
      previewHtml.includes(CUSTOM_MARKER) &&
        previewHtml.includes('data-readopp-canvas-override="true"'),
      "custom preview did not use the complete canvas override"
    );
  } else if (format === "square") {
    assert(
      previewHtml.includes('aria-label="Editable panel preview"'),
      "template preview did not use the canonical editable scene"
    );
  } else {
    assert(
      /<!doctype html>/i.test(previewHtml) &&
        /<html\b/i.test(previewHtml) &&
        previewHtml.length > 1_000,
      `${format} template preview did not return a complete render document`
    );
  }
  const previewPng = await screenshotHtml(renderContext, previewHtml, format);

  const exportResponse = await api.post(
    `${BASE}/api/explainers/${explainerId}/export`,
    { data: { format, panelId: sectionId } }
  );
  assert(
    exportResponse.ok(),
    `${kind} export failed (${exportResponse.status()}): ${await exportResponse.text()}`
  );
  const result = await exportResponse.json();
  const assetUrl = new URL(result.url, BASE).toString();
  const assetResponse = await api.get(assetUrl);
  assert(assetResponse.ok(), `${kind} export asset could not be downloaded`);
  const exportPng = Buffer.from(await assetResponse.body());
  assert(
    digest(exportPng) === digest(previewPng),
    `${kind} panel preview and exported PNG pixels diverged`
  );
  console.log(`✓ ${format} ${kind}: ${sectionId} ${digest(exportPng).slice(0, 12)}`);
}

async function assertWholeStorySet(api, format, expectedPanelCount) {
  const response = await api.post(
    `${BASE}/api/explainers/${explainerId}/export`,
    { data: { format } }
  );
  assert(
    response.ok(),
    `${format} whole-story export failed (${response.status()}): ${await response.text()}`
  );
  const result = await response.json();
  assert(result.kind === "set", `${format} whole-story export was not a reusable image set`);
  assert(
    result.images?.length === expectedPanelCount + 1,
    `${format} export returned ${result.images?.length ?? 0} images instead of ${expectedPanelCount} panels plus one source slide`
  );
  assert(result.zipUrl, `${format} whole-story export did not include a ZIP download`);
  assert(
    result.images.at(-1)?.kind === "attribution",
    `${format} whole-story export did not end with a source slide`
  );
  console.log(`✓ ${format} whole story: ${expectedPanelCount} panels + source slide`);
}

async function main() {
  assert(
    formats.length > 0 && formats.length === requestedFormats.length || requestedFormats.length === 0,
    `Unknown export format. Choose from: ${Object.keys(EXPORT_DIMENSIONS).join(", ")}`
  );
  browser = await chromium.launch({ headless: true });
  const session = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const api = session.request;
  const renderContext = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 2,
  });

  console.log("→ create an isolated mixed-carousel fixture");
  const home = await session.newPage();
  await home.goto(BASE, { waitUntil: "domcontentloaded" });
  const fixtureResponse = await api.post(
    `${BASE}/api/dev/fixtures/mobile-editor`,
    { headers: { "x-readopp-e2e": "mobile-editor-flow-v1" } }
  );
  assert(
    fixtureResponse.status() === 201,
    `fixture failed (${fixtureResponse.status()}): ${await fixtureResponse.text()}`
  );
  const fixture = await fixtureResponse.json();
  jobId = fixture.jobId;
  explainerId = fixture.explainerId;

  const templateResponse = await api.patch(
    `${BASE}/api/explainers/${explainerId}`,
    { data: { template: "data-story" } }
  );
  assert(templateResponse.ok(), "data-story identity could not be selected");

  const customSvg = `<svg data-readopp-canvas-override="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#F6EFE5"/><circle cx="820" cy="270" r="180" fill="#E25542"/><path d="M110 760H970" stroke="#111111" stroke-width="10"/><text x="110" y="230" fill="#111111" font-family="Arial, sans-serif" font-size="70" font-weight="700">${CUSTOM_MARKER}</text><text x="110" y="860" fill="#111111" font-family="Arial, sans-serif" font-size="36">Designed directly in canvas</text></svg>`;
  const customResponse = await api.patch(
    `${BASE}/api/explainers/${explainerId}/panels/protect-focus`,
    { data: { content: customSvg } }
  );
  assert(customResponse.ok(), "canvas override could not be persisted");

  for (const format of formats) {
    console.log(`→ compare ${format} customized preview and export pixels`);
    await assertPanelParity(api, renderContext, "protect-focus", "custom", format);
    console.log(`→ compare ${format} template-managed preview and export pixels`);
    await assertPanelParity(api, renderContext, "less-switching", "template", format);
    await assertWholeStorySet(api, format, fixture.panelCount ?? 4);
  }

  await home.close();
  await renderContext.close();
  await session.close();
  console.log("✓ mixed custom/template export parity passed");
}

try {
  await main();
} finally {
  await browser?.close();
  await cleanup();
}
