/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enables instrumentation.ts register() — used to boot the background
    // job pump in a process-owned context (see lib/pipeline/runner.ts).
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      "@mozilla/readability",
      "jsdom",
      // Native SVG→PNG rasteriser; webpack can't parse the .node addon, so
      // keep it external on both dev and serverless builds.
      "@resvg/resvg-js",
      // Playwright (local) + the serverless Chromium build (Vercel) are
      // heavy native modules. Marking them external prevents Next from
      // bundling them, which would bloat the function and break native deps.
      "playwright",
      "playwright-core",
      "@sparticuz/chromium",
      "@ffmpeg-installer/ffmpeg",
      "qrcode",
    ],
    // Externalising @sparticuz/chromium keeps the JS out of the bundle, but
    // Next's output-file-tracer also has to copy the Chromium binary (and
    // bundled ffmpeg) into the serverless function dir or runtime can't find
    // them. Same for the bundled ffmpeg used by the video render path.
    outputFileTracingIncludes: {
      "/api/explainers/**": [
        "./node_modules/@sparticuz/chromium/**",
        "./node_modules/@ffmpeg-installer/**",
      ],
    },
  },
};

export default nextConfig;
