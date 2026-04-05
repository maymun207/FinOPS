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

/**
 * Public procedure — no auth required.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure — throws UNAUTHORIZED if not signed in.
 * Narrows ctx.userId and ctx.db to non-null.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
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
 * Narrows ctx.userId, ctx.companyId, ctx.orgId to non-null.
 */
export const companyProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.companyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No company found for this organization",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      companyId: ctx.companyId,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      orgId: ctx.orgId!,
    },
  });
});
