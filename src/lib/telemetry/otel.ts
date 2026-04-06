/**
 * otel — OpenTelemetry provider + span helpers for FinOPS.
 *
 * Uses @opentelemetry/api for creating spans that wrap key operations.
 * Traces are exported to Axiom (which accepts OTLP) or to console in dev.
 *
 * In production, Sentry also picks up these spans via its OTel integration.
 */
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

// ── Tracer ──────────────────────────────────────────────────────────

const TRACER_NAME = "finops";

/**
 * Get the FinOPS tracer instance.
 */
export function getTracer() {
  return trace.getTracer(TRACER_NAME, "1.0.0");
}

// ── Span helpers ────────────────────────────────────────────────────

export interface SpanOptions {
  /** Span name (e.g., 'trpc.invoice.create') */
  name: string;
  /** Additional attributes */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Wrap an async operation in an OpenTelemetry span.
 *
 * @param opts - Span name and optional attributes
 * @param fn - Async function to execute within the span
 * @returns The result of fn
 */
export async function withSpan<T>(
  opts: SpanOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(opts.name, async (span) => {
    if (opts.attributes) {
      for (const [key, value] of Object.entries(opts.attributes)) {
        span.setAttribute(key, value);
      }
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a child span for a specific operation.
 * Useful for instrumenting sub-operations within a larger trace.
 */
export function startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
  const span = getTracer().startSpan(name);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
  return span;
}
