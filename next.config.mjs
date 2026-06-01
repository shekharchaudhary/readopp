/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@mozilla/readability",
      "jsdom",
      "playwright",
      "@ffmpeg-installer/ffmpeg",
      "qrcode",
    ],
  },
};

export default nextConfig;
