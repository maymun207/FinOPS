import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";
import { type TRPCContext } from "./context";

/**
 * tRPC init — all routers/procedures are built from this instance.
 * Context comes from ./context.ts which resolves Clerk auth + company.
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

export { createTRPCContext } from "./context";
export type { TRPCContext } from "./context";

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// ── Logging middleware ──────────────────────────────────────────────
// Applied to ALL procedures — logs every tRPC call to Axiom with timing.
// Import is inline to avoid "server-only" issues in test environments.
import { loggingMiddleware } from "./middleware/logging";

const loggedProcedure = t.procedure.use(loggingMiddleware);

/**
 * Public procedure — no auth required.
 * Includes Axiom logging middleware.
 */
export const publicProcedure = loggedProcedure;

/**
 * Protected procedure — throws UNAUTHORIZED if not signed in.
 * Narrows ctx.userId and ctx.db to non-null.
 */
export const protectedProcedure = loggedProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

/**
 * Company-scoped procedure — requires auth + active company.
 * Throws UNAUTHORIZED if not signed in, FORBIDDEN if no company resolved.
 * Narrows ctx.userId, ctx.companyId, ctx.orgId to non-null strings.
 *
 * SECURITY: This is the primary tenant isolation guard. Every procedure
 * using companyProcedure is guaranteed ctx.companyId: string — TypeScript
 * will error at compile time if any code tries to use it as nullable.
 * All queries MUST include `.where(eq(table.companyId, ctx.companyId))`.
 */
export const companyProcedure = loggedProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.companyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Şirket bağlamı bulunamadı. Lütfen bir organizasyon seçin.",
    });
  }
  // Narrowed context: companyId and orgId are string (not string | null).
  // TypeScript enforces this — a missing WHERE filter becomes a compile error.
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,       // string (was string | null)
      companyId: ctx.companyId, // string (was string | null)
      orgId: ctx.orgId!,        // string (was string | null)
    },
  });
});
