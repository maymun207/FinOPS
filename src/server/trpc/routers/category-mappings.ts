import "server-only";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { categoryMappings, chartOfAccounts } from "@/server/db/schema";

/**
 * Category Mappings tRPC router — bridges UI categories to TDHP accounts.
 *
 * Used to auto-assign account codes when categorizing transactions.
 * Each company can customize its own category→account mapping.
 */
export const categoryMappingsRouter = createTRPCRouter({
  /**
   * List all mappings for the current company, joined with account details.
   */
  list: companyProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: categoryMappings.id,
        categoryLabel: categoryMappings.categoryLabel,
        accountId: categoryMappings.accountId,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        createdAt: categoryMappings.createdAt,
      })
      .from(categoryMappings)
      .innerJoin(
        chartOfAccounts,
        eq(categoryMappings.accountId, chartOfAccounts.id)
      )
      .where(eq(categoryMappings.companyId, ctx.companyId))
      .orderBy(asc(categoryMappings.categoryLabel));
  }),

  /**
   * Create a new category→account mapping.
   */
  create: companyProcedure
    .input(
      z.object({
        categoryLabel: z.string().min(1, "Kategori adı zorunludur"),
        accountId: z.uuid("Geçerli bir hesap seçmelisiniz"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [mapping] = await ctx.db
        .insert(categoryMappings)
        .values({
          companyId: ctx.companyId,
          categoryLabel: input.categoryLabel,
          accountId: input.accountId,
        })
        .returning();

      return mapping!;
    }),

  /**
   * Update a mapping's target account or label.
   */
  update: companyProcedure
    .input(
      z.object({
        id: z.uuid(),
        categoryLabel: z.string().min(1).optional(),
        accountId: z.uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existing = await ctx.db
        .select({ id: categoryMappings.id })
        .from(categoryMappings)
        .where(
          and(
            eq(categoryMappings.id, id),
            eq(categoryMappings.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0]);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mapping not found",
        });
      }

      const [updated] = await ctx.db
        .update(categoryMappings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(categoryMappings.id, id))
        .returning();

      return updated!;
    }),

  /**
   * Delete a category mapping.
   */
  delete: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: categoryMappings.id })
        .from(categoryMappings)
        .where(
          and(
            eq(categoryMappings.id, input.id),
            eq(categoryMappings.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0]);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mapping not found",
        });
      }

      await ctx.db
        .delete(categoryMappings)
        .where(eq(categoryMappings.id, input.id));

      return { success: true };
    }),
});
