import "server-only";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { companies } from "@/server/db/schema";

/**
 * Companies tRPC router — CRUD for the current user's company.
 *
 * Uses protectedProcedure (requires auth) to resolve the company
 * from the Clerk orgId stored in context.
 */
export const companiesRouter = createTRPCRouter({
  /**
   * Get the current user's company.
   * Returns null if no company is associated with the user's org.
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.companyId) return null;

    const rows = await ctx.db
      .select()
      .from(companies)
      .where(eq(companies.id, ctx.companyId))
      .then((rows) => rows[0] ?? null);

    return rows;
  }),
});
