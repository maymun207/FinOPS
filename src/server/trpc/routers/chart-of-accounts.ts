import "server-only";
import { eq, or, and, isNull, asc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { chartOfAccounts } from "@/server/db/schema";

/**
 * Chart of Accounts tRPC router — TDHP account management.
 *
 * Uses companyProcedure (requires auth + resolved company).
 * Returns both system-default TDHP accounts (company_id IS NULL)
 * and company-specific overrides.
 */
export const chartOfAccountsRouter = createTRPCRouter({
  /**
   * List all accounts available to the current company.
   * Includes system defaults (company_id IS NULL) and company-specific accounts.
   * Ordered by account code for consistent display.
   */
  list: companyProcedure.query(async ({ ctx }) => {
    // System-default TDHP accounts (template)
    const templateAccounts = await ctx.db
      .select()
      .from(chartOfAccounts)
      .where(isNull(chartOfAccounts.companyId))
      .orderBy(asc(chartOfAccounts.code));

    // Company-specific overrides/additions
    const companyAccounts = await ctx.db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.companyId, ctx.companyId))
      .orderBy(asc(chartOfAccounts.code));

    return {
      template: templateAccounts,
      company: companyAccounts,
      total: templateAccounts.length + companyAccounts.length,
    };
  }),

  /**
   * Get a single account by its code.
   * Checks company-specific accounts first, then falls back to system templates.
   * Returns null if no account matches the given code.
   */
  getByCode: companyProcedure
    .input(z.object({ code: z.string().min(1).max(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(chartOfAccounts)
        .where(
          and(
            eq(chartOfAccounts.code, input.code),
            or(
              eq(chartOfAccounts.companyId, ctx.companyId),
              isNull(chartOfAccounts.companyId)
            )
          )
        )
        .orderBy(asc(chartOfAccounts.companyId)); // company-specific first (non-null sorts before null in asc)

      // Prefer company-specific override over template
      return rows[0] ?? null;
    }),
});
