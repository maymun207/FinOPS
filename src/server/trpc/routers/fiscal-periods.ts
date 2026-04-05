import "server-only";
import { eq, and, asc, lte, gte } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { fiscalPeriods } from "@/server/db/schema";

/**
 * Fiscal Periods tRPC router — manage accounting periods.
 *
 * Uses companyProcedure (requires auth + resolved company).
 * Supports listing periods and closing an open period.
 */
export const fiscalPeriodsRouter = createTRPCRouter({
  /**
   * List all fiscal periods for the current company.
   * Ordered by start_date ascending.
   */
  list: companyProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.companyId, ctx.companyId))
      .orderBy(asc(fiscalPeriods.startDate));
  }),

  /**
   * Get the current (active) fiscal period.
   * Returns the open period whose date range contains today.
   * Returns null if no matching period exists.
   */
  getCurrent: companyProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rows = await ctx.db
      .select()
      .from(fiscalPeriods)
      .where(
        and(
          eq(fiscalPeriods.companyId, ctx.companyId),
          eq(fiscalPeriods.isClosed, false),
          lte(fiscalPeriods.startDate, today),
          gte(fiscalPeriods.endDate, today)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }),

  /**
   * Close a fiscal period — prevents further transactions.
   *
   * Sets is_closed = true, closed_at = now(), closed_by = current user.
   * Throws CONFLICT if the period is already closed.
   * Throws NOT_FOUND if the period doesn't exist or belongs to another company.
   */
  closePeriod: companyProcedure
    .input(z.object({ periodId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify period belongs to this company and is still open
      const existing = await ctx.db
        .select()
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.id, input.periodId),
            eq(fiscalPeriods.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fiscal period not found",
        });
      }

      if (existing.isClosed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Period is already closed",
        });
      }

      // Close the period
      const updated = await ctx.db
        .update(fiscalPeriods)
        .set({
          isClosed: true,
          closedAt: new Date(),
          closedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(fiscalPeriods.id, input.periodId))
        .returning();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return updated[0]!;
    }),

  /**
   * Open (reopen) a previously closed fiscal period.
   * Resets is_closed, closed_at, and closed_by.
   */
  openPeriod: companyProcedure
    .input(z.object({ periodId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.id, input.periodId),
            eq(fiscalPeriods.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fiscal period not found",
        });
      }

      if (!existing.isClosed) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Period is already open",
        });
      }

      const updated = await ctx.db
        .update(fiscalPeriods)
        .set({
          isClosed: false,
          closedAt: null,
          closedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(fiscalPeriods.id, input.periodId))
        .returning();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return updated[0]!;
    }),
});
