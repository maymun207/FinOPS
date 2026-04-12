/**
 * Quarantine tRPC Router — review, approve, reject quarantined records.
 *
 * Endpoints:
 *   quarantine.list      — paginated list with status filter
 *   quarantine.approve   — validate + promote record to live table
 *   quarantine.reject    — mark record as rejected with reason
 *   quarantine.bulkApprove — approve + promote multiple records
 *   quarantine.bulkReject  — reject multiple records
 *   quarantine.update    — inline edit of a quarantine record's rawData
 *
 * JOURNAL GROUPING:
 *   Each journal template row is one side of a double-entry (debit OR credit).
 *   When approving a journal record, we find ALL pending journal records with
 *   the same (entryDate, description) and promote them together as one
 *   journal entry. This ensures the DB balance trigger is satisfied.
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { importQuarantine } from "../../db/schema/import-quarantine";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  promoteContact,
  promoteInvoice,
  promoteJournalEntry,
} from "../../import/promote";

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
   * Validates rawData with the import schema, promotes to the live table,
   * then marks the record as approved. If validation fails, rejects it.
   *
   * For journal type: automatically groups all pending records with the
   * same entryDate + description and promotes them together.
   */
  approve: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the quarantine record
      const [record] = await ctx.db
        .select()
        .from(importQuarantine)
        .where(
          and(
            eq(importQuarantine.id, input.id),
            eq(importQuarantine.companyId, ctx.companyId),
            eq(importQuarantine.status, "pending")
          )
        );

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bekleyen kayıt bulunamadı",
        });
      }

      const importType = record.importType;
      const rawData = record.rawData as Record<string, unknown>;

      if (!importType) {
        // Legacy records without importType — just mark approved (no promotion)
        const [updated] = await ctx.db
          .update(importQuarantine)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(importQuarantine.id, input.id))
          .returning();
        return updated;
      }

      // Try to promote the record
      try {
        if (importType === "contact") {
          await promoteContact(ctx.db, ctx.companyId, rawData);

          // Mark as approved
          const [updated] = await ctx.db
            .update(importQuarantine)
            .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
            .where(eq(importQuarantine.id, input.id))
            .returning();
          return updated;

        } else if (importType === "invoice") {
          await promoteInvoice(ctx.db, ctx.companyId, rawData, ctx.userId);

          // Mark as approved
          const [updated] = await ctx.db
            .update(importQuarantine)
            .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
            .where(eq(importQuarantine.id, input.id))
            .returning();
          return updated;

        } else if (importType === "journal") {
          // ── JOURNAL GROUPING ──────────────────────────────────────────
          // Each row is one side of a double-entry. We must find ALL
          // pending journal records with the same entryDate + description
          // and promote them as a single journal entry.
          const entryDate = rawData.entryDate as string | undefined;
          const description = rawData.description as string | undefined;

          if (!entryDate || !description) {
            throw new Error("Yevmiye kaydı için tarih ve açıklama zorunludur.");
          }

          // Fetch all pending journal records for this company
          const allPendingJournals = await ctx.db
            .select()
            .from(importQuarantine)
            .where(
              and(
                eq(importQuarantine.companyId, ctx.companyId),
                eq(importQuarantine.status, "pending"),
                eq(importQuarantine.importType, "journal")
              )
            );

          // Filter in JS for matching entryDate + description
          const groupedRows = allPendingJournals.filter((r) => {
            const rd = r.rawData as Record<string, unknown>;
            return rd.entryDate === entryDate && rd.description === description;
          });

          // Promote the full group as one journal entry
          await promoteJournalEntry(
            ctx.db,
            ctx.companyId,
            ctx.userId,
            groupedRows.map((r) => ({ rawData: r.rawData as Record<string, unknown> }))
          );

          // Mark ALL grouped rows as approved
          const groupedIds = groupedRows.map((r) => r.id);
          await ctx.db
            .update(importQuarantine)
            .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
            .where(inArray(importQuarantine.id, groupedIds));

          // Return the originally requested record
          const [updated] = await ctx.db
            .select()
            .from(importQuarantine)
            .where(eq(importQuarantine.id, input.id));
          return updated;
        }

        // Unknown import type — just mark approved
        const [updated] = await ctx.db
          .update(importQuarantine)
          .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
          .where(eq(importQuarantine.id, input.id))
          .returning();
        return updated;

      } catch (err) {
        // Promotion failed — mark as rejected with the error
        const errorMessage =
          err instanceof Error ? err.message : "Bilinmeyen hata";

        const [updated] = await ctx.db
          .update(importQuarantine)
          .set({
            status: "rejected",
            errorMessage: `Onay hatası: ${errorMessage}`,
            updatedAt: new Date(),
          })
          .where(eq(importQuarantine.id, input.id))
          .returning();

        return updated;
      }
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
   * Groups journal records by (entryDate + description) to ensure
   * each double-entry is promoted as a single journal entry.
   * Partial success is permitted — individual failures don't block others.
   */
  bulkApprove: companyProcedure
    .input(z.object({ ids: z.array(z.uuid()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { approved: 0, failed: 0 };

      // Fetch all pending records
      const records = await ctx.db
        .select()
        .from(importQuarantine)
        .where(
          and(
            inArray(importQuarantine.id, input.ids),
            eq(importQuarantine.companyId, ctx.companyId),
            eq(importQuarantine.status, "pending")
          )
        );

      let approved = 0;
      let failed = 0;

      // Track already-processed journal group keys to avoid double-promotion
      const processedJournalGroups = new Set<string>();

      for (const record of records) {
        const importType = record.importType;
        const rawData = record.rawData as Record<string, unknown>;

        try {
          if (importType === "contact") {
            await promoteContact(ctx.db, ctx.companyId, rawData);

            await ctx.db
              .update(importQuarantine)
              .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
              .where(eq(importQuarantine.id, record.id));
            approved++;

          } else if (importType === "invoice") {
            await promoteInvoice(ctx.db, ctx.companyId, rawData, ctx.userId);

            await ctx.db
              .update(importQuarantine)
              .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
              .where(eq(importQuarantine.id, record.id));
            approved++;

          } else if (importType === "journal") {
            // ── JOURNAL GROUPING ──────────────────────────────────────
            const entryDate = rawData.entryDate as string | undefined;
            const description = rawData.description as string | undefined;

            if (!entryDate || !description) {
              throw new Error("Yevmiye kaydı için tarih ve açıklama zorunludur.");
            }

            const groupKey = `${entryDate}:::${description}`;

            // Skip if this group was already promoted by a sibling row
            if (processedJournalGroups.has(groupKey)) {
              continue; // Already counted in the previous iteration
            }
            processedJournalGroups.add(groupKey);

            // Find ALL pending journal records in this group (may include
            // records not in the current selection — they form the full entry)
            const allPendingJournals = await ctx.db
              .select()
              .from(importQuarantine)
              .where(
                and(
                  eq(importQuarantine.companyId, ctx.companyId),
                  eq(importQuarantine.status, "pending"),
                  eq(importQuarantine.importType, "journal")
                )
              );

            const groupedRows = allPendingJournals.filter((r) => {
              const rd = r.rawData as Record<string, unknown>;
              return rd.entryDate === entryDate && rd.description === description;
            });

            // Promote the full group as one journal entry
            await promoteJournalEntry(
              ctx.db,
              ctx.companyId,
              ctx.userId,
              groupedRows.map((r) => ({ rawData: r.rawData as Record<string, unknown> }))
            );

            // Mark ALL grouped rows as approved
            const groupedIds = groupedRows.map((r) => r.id);
            await ctx.db
              .update(importQuarantine)
              .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
              .where(inArray(importQuarantine.id, groupedIds));

            approved += groupedRows.length;

          } else {
            // Unknown type — just approve
            await ctx.db
              .update(importQuarantine)
              .set({ status: "approved", errorMessage: null, updatedAt: new Date() })
              .where(eq(importQuarantine.id, record.id));
            approved++;
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Bilinmeyen hata";

          await ctx.db
            .update(importQuarantine)
            .set({
              status: "rejected",
              errorMessage: `Onay hatası: ${errorMessage}`,
              updatedAt: new Date(),
            })
            .where(eq(importQuarantine.id, record.id));

          failed++;
        }
      }

      return { approved, failed };
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
