/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@mozilla/readability",
      "jsdom",
      "playwright",
    ],
  },
};

export default nextConfig;
