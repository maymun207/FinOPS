import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Existing Next.js configuration
  reactStrictMode: true,

  // ESLint is enforced separately via `pnpm lint` in CI.
  // Skipping during `next build` avoids duplicate runs and lets
  // the build focus on compilation errors only.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation & project slugs (match your Sentry dashboard)
  org: "finops-team",
  project: "finops",

  // Only print source-map upload logs in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Route browser events through the Next.js server to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Delete source maps after upload so they're not served to clients
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Automatically tree-shake Sentry logger statements in production
  disableLogger: true,

  // Auth token for source map uploads — set in CI env
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
