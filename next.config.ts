import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the local Playwright harness (hard-pinned to 127.0.0.1) reach the
  // dev server's Fast Refresh/HMR endpoint. Dev-only: `allowedDevOrigins`
  // has no effect on `next build` / `next start`.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
