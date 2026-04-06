import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_duakssiafwiyuuqoyras",
  runtime: "node",
  logLevel: "log",

  // Maximum run duration — prevent runaway jobs
  maxDuration: 300, // 5 minutes

  // Retry configuration
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
    },
  },

  // Directories containing task definitions
  dirs: ["src/server/jobs"],

  // Exclude jobs that depend on @/server/db → env.ts validation chain.
  // These need all Next.js env vars which aren't available in the Trigger.dev
  // container. Only vanna-* jobs are self-contained (raw pg.Pool + Gemini API).
  ignorePatterns: [
    "**/billing-reminder-daily*",
    "**/duckdb-nightly-sync*",
    "**/excel-import-large*",
    "**/report-generate*",
  ],

  // Build configuration — exclude native/binary deps from bundling
  build: {
    external: [
      "duckdb",
      "@duckdb/node-api",
      "playwright",
      "playwright-core",
      "@mapbox/node-pre-gyp",
      "nock",
      "mock-aws-s3",
      "aws-sdk",
    ],
  },
});
