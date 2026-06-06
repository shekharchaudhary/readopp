/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@mozilla/readability",
      "jsdom",
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
