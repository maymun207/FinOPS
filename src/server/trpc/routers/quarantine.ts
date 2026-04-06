/**
 * Quarantine tRPC Router — review, approve, reject quarantined records.
 *
 * Endpoints:
 *   quarantine.list      — paginated list with status filter
 *   quarantine.approve   — promote record to live table
 *   quarantine.reject    — mark record as rejected with reason
 *   quarantine.bulkApprove — approve multiple records
 *   quarantine.bulkReject  — reject multiple records
 *   quarantine.update    — inline edit of a quarantine record's rawData
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { importQuarantine } from "../../db/schema/import-quarantine";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export const quarantineRouter = createTRPCRouter({
  /**
   * List quarantine records with pagination and status filter.
   */
  list: companyProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(importQuarantine.companyId, ctx.companyId),
      ];

      if (input.status) {
        conditions.push(eq(importQuarantine.status, input.status));
      }

      const [rows, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(importQuarantine)
          .where(and(...conditions))
          .orderBy(desc(importQuarantine.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(importQuarantine)
          .where(and(...conditions)),
      ]);

      return {
        rows,
        total: countResult[0]?.count ?? 0,
      };
    }),

  /**
   * Approve a single quarantine record.
   * Sets status='approved'. Actual promotion logic is separate.
   */
  approve: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(importQuarantine)
        .set({
          status: "approved",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importQuarantine.id, input.id),
            eq(importQuarantine.companyId, ctx.companyId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Reject a single quarantine record with a reason.
   */
  reject: companyProcedure
    .input(
      z.object({
        id: z.uuid(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(importQuarantine)
        .set({
          status: "rejected",
          errorMessage: input.reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importQuarantine.id, input.id),
            eq(importQuarantine.companyId, ctx.companyId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Bulk approve multiple quarantine records.
   */
  bulkApprove: companyProcedure
    .input(z.object({ ids: z.array(z.uuid()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { updated: 0 };

      const result = await ctx.db
        .update(importQuarantine)
        .set({
          status: "approved",
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(importQuarantine.id, input.ids),
            eq(importQuarantine.companyId, ctx.companyId)
          )
        )
        .returning({ id: importQuarantine.id });

      return { updated: result.length };
    }),

  /**
   * Bulk reject multiple quarantine records.
   */
  bulkReject: companyProcedure
    .input(
      z.object({
        ids: z.array(z.uuid()).max(500),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { updated: 0 };

      const result = await ctx.db
        .update(importQuarantine)
        .set({
          status: "rejected",
          errorMessage: input.reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(importQuarantine.id, input.ids),
            eq(importQuarantine.companyId, ctx.companyId)
          )
        )
        .returning({ id: importQuarantine.id });

      return { updated: result.length };
    }),

  /**
   * Inline edit a quarantine record's rawData.
   * Only allowed when status is 'pending'.
   */
  update: companyProcedure
    .input(
      z.object({
        id: z.uuid(),
        rawData: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(importQuarantine)
        .set({
          rawData: input.rawData,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importQuarantine.id, input.id),
            eq(importQuarantine.companyId, ctx.companyId),
            eq(importQuarantine.status, "pending")
          )
        )
        .returning();

      return updated;
    }),
});
