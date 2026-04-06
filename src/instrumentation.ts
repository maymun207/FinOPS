import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation — loaded before any route handler.
 *
 * Responsibilities:
 *   1. Sentry server/edge config
 *   2. OpenTelemetry trace provider (exports to Axiom via OTLP)
 *
 * Note: Next.js 15 automatically loads this file from src/instrumentation.ts.
 * No experimental flag needed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Initialize OpenTelemetry for server-side tracing
    // Sentry's Next.js SDK integrates with OTel automatically
    // when @opentelemetry/api is available in node_modules.
    // Additional custom spans are created via src/lib/telemetry/otel.ts
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError = Sentry.captureRequestError;
