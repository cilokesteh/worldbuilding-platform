import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo ini punya lockfile sendiri; abaikan package-lock di home dir.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
