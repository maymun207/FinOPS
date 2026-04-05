import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "finops",
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
});
