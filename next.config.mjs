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
  },
};

export default nextConfig;
