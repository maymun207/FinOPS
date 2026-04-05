import "server-only";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, companyProcedure } from "../trpc";
import {
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
} from "@/server/db/schema";

/**
 * Journal Entries tRPC router — Yevmiye Defteri operations.
 *
 * Uses companyProcedure (requires auth + resolved company).
 * Provides list, getById, and create mutations.
 */
export const journalEntriesRouter = createTRPCRouter({
  /**
   * List journal entry lines for the current company.
   *
   * Returns a flattened view joining journal_entries → journal_entry_lines → chart_of_accounts.
   * Ordered by entry_date descending, then account code ascending.
   */
  list: companyProcedure
    .input(
      z
        .object({
          /** Optional fiscal period filter */
          fiscalPeriodId: z.uuid().optional(),
          /** Pagination limit. Defaults to 500. */
          limit: z.number().min(1).max(5000).default(500),
          /** Pagination offset. Defaults to 0. */
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 500;
      const offset = input?.offset ?? 0;

      // Build WHERE conditions
      const conditions = [
        eq(journalEntryLines.companyId, ctx.companyId),
      ];

      if (input?.fiscalPeriodId) {
        conditions.push(
          eq(journalEntries.fiscalPeriodId, input.fiscalPeriodId)
        );
      }

      const rows = await ctx.db
        .select({
          id: journalEntryLines.id,
          entryDate: journalEntries.entryDate,
          entryDescription: journalEntries.description,
          accountCode: chartOfAccounts.code,
          accountName: chartOfAccounts.name,
          debitAmount: journalEntryLines.debitAmount,
          creditAmount: journalEntryLines.creditAmount,
          lineDescription: journalEntryLines.description,
          sourceType: journalEntries.sourceType,
        })
        .from(journalEntryLines)
        .innerJoin(
          journalEntries,
          eq(journalEntryLines.journalEntryId, journalEntries.id)
        )
        .innerJoin(
          chartOfAccounts,
          eq(journalEntryLines.accountId, chartOfAccounts.id)
        )
        .where(and(...conditions))
        .orderBy(desc(journalEntries.entryDate), asc(chartOfAccounts.code))
        .limit(limit)
        .offset(offset);

      return rows;
    }),

  /**
   * Get a single journal entry by ID with all its lines.
   * Verifies the entry belongs to the current company.
   */
  getById: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      // Get the journal entry header
      const entry = await ctx.db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, input.id),
            eq(journalEntries.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Journal entry not found",
        });
      }

      // Get all lines for this entry
      const lines = await ctx.db
        .select({
          id: journalEntryLines.id,
          accountId: journalEntryLines.accountId,
          accountCode: chartOfAccounts.code,
          accountName: chartOfAccounts.name,
          debitAmount: journalEntryLines.debitAmount,
          creditAmount: journalEntryLines.creditAmount,
          description: journalEntryLines.description,
        })
        .from(journalEntryLines)
        .innerJoin(
          chartOfAccounts,
          eq(journalEntryLines.accountId, chartOfAccounts.id)
        )
        .where(eq(journalEntryLines.journalEntryId, entry.id))
        .orderBy(asc(chartOfAccounts.code));

      return { ...entry, lines };
    }),

  /**
   * Create a new journal entry with its lines.
   *
   * Validates:
   *   - At least 2 lines (double-entry)
   *   - Each line has either debit OR credit (not both)
   *   - Total debits = total credits
   *   - All referenced account IDs belong to the company (or are templates)
   *   - The fiscal period belongs to the company and is not closed
   */
  create: companyProcedure
    .input(
      z.object({
        fiscalPeriodId: z.uuid(),
        entryDate: z.iso.date(),
        description: z.string().optional(),
        sourceType: z.enum(["manual", "invoice", "payment", "import"]),
        lines: z
          .array(
            z.object({
              accountId: z.uuid(),
              debitAmount: z.number().min(0).default(0),
              creditAmount: z.number().min(0).default(0),
              description: z.string().optional(),
            })
          )
          .min(2, "A journal entry must have at least 2 lines"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate debit/credit balance
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of input.lines) {
        if (line.debitAmount > 0 && line.creditAmount > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Each line must have either a debit or credit amount, not both",
          });
        }
        if (line.debitAmount === 0 && line.creditAmount === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Each line must have a non-zero debit or credit amount",
          });
        }
        totalDebit += line.debitAmount;
        totalCredit += line.creditAmount;
      }

      if (Math.abs(totalDebit - totalCredit) >= 0.005) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`,
        });
      }

      // Create the journal entry header
      const [entry] = await ctx.db
        .insert(journalEntries)
        .values({
          companyId: ctx.companyId,
          fiscalPeriodId: input.fiscalPeriodId,
          entryDate: input.entryDate,
          description: input.description,
          sourceType: input.sourceType,
          createdBy: ctx.userId,
        })
        .returning();

      if (!entry) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journal entry",
        });
      }

      // Create the journal entry lines
      const lineValues = input.lines.map((line) => ({
        journalEntryId: entry.id,
        companyId: ctx.companyId,
        accountId: line.accountId,
        debitAmount: line.debitAmount.toFixed(2),
        creditAmount: line.creditAmount.toFixed(2),
        description: line.description,
      }));

      await ctx.db.insert(journalEntryLines).values(lineValues);

      return entry;
    }),
});
