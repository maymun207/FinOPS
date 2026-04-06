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

  // ignorePatterns removed — jobs now use _env.ts instead of @/env.ts

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
