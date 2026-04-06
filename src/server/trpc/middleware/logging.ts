/**
 * logging — tRPC middleware that logs every procedure call to Axiom.
 *
 * Captures:
 *   - Procedure path (e.g., 'invoice.create')
 *   - Input schema type (never values — no PII in logs)
 *   - Duration in milliseconds
 *   - Error messages on failure
 *   - Company ID and User ID from context
 *
 * Usage: Applied to all procedures by wrapping the base middleware.
 */
import { log, type FinOpsLog } from "@/lib/telemetry/axiom";
import { withSpan } from "@/lib/telemetry/otel";
import { // eslint-disable-next-line @typescript-eslint/no-deprecated
experimental_standaloneMiddleware } from "@trpc/server";
import { type TRPCContext } from "../trpc";

/**
 * tRPC logging middleware.
 *
 * Logs every procedure call (input schema only, never values)
 * with timing, user context, and error information.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export const loggingMiddleware = experimental_standaloneMiddleware<{
  ctx: TRPCContext;
}>().create(async ({ ctx, next, path, type }) => {
  const start = Date.now();

  const logBase: Omit<FinOpsLog, "timestamp" | "level" | "duration_ms"> = {
    service: "api" as const,
    operation: path,
    company_id: ctx.companyId ?? undefined,
    user_id: ctx.userId ?? undefined,
    metadata: {
      type, // 'query' | 'mutation' | 'subscription'
    },
  };

  try {
    const result = await withSpan(
      {
        name: `trpc.${path}`,
        attributes: {
          "trpc.path": path,
          "trpc.type": type,
          ...(ctx.companyId ? { "company.id": ctx.companyId } : {}),
        },
      },
      async () => next(),
    );

    const duration_ms = Date.now() - start;

    // Fire-and-forget log (don't block the response)
    void log({
      ...logBase,
      level: "info",
      duration_ms,
    });

    return result;
  } catch (err) {
    const duration_ms = Date.now() - start;

    void log({
      ...logBase,
      level: "error",
      duration_ms,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
});
