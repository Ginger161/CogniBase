import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["geoip-lite"],
  // Development only: lets the dev server's scripts load when the app is opened at 127.0.0.1 instead of localhost
  // (browsers keep separate cookies for each, which is handy for testing as a second user). No effect in production.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
