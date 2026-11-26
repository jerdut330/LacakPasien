import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // lib/gemini.ts reads prompts/<name>.md at runtime by a built path, which tracing can't see.
  outputFileTracingIncludes: { "/**": ["./prompts/**/*"] },
  // Dev only: lets a phone on the same Wi-Fi load the dev scripts (QR scan test).
  allowedDevOrigins: ["192.168.1.5"],
  // Families arrive with a QR link to /track/[token]; everyone else is staff.
  async redirects() {
    return [{ source: "/", destination: "/login", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
