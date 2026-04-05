import "server-only";
import { eq, and, sql } from "drizzle-orm";
import { createTRPCRouter, companyProcedure } from "../trpc";
import {
  invoices,
  journalEntryLines,
  contacts,
  fiscalPeriods,
} from "@/server/db/schema";

/**
 * Dashboard tRPC router — KPI data aggregation.
 *
 * Provides aggregated financial metrics for the operational dashboard:
 *   - Revenue (outbound invoice totals)
 *   - Expenses (inbound invoice totals)
 *   - Net income (revenue - expenses)
 *   - Outstanding receivables / payables
 *   - Contact count
 *   - Current fiscal period info
 *
 * All values are computed as strings (Decimal precision) via SQL SUM().
 */
export const dashboardRouter = createTRPCRouter({
  /**
   * Get all KPI metrics for the current company.
   * Returns aggregated values for the current open fiscal period.
   */
  getKPIs: companyProcedure.query(async ({ ctx }) => {
    // ── Revenue: sum of outbound invoice grandTotal ──────────────
    const [revenueRow] = await ctx.db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)`.as("total"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, ctx.companyId),
          eq(invoices.direction, "outbound")
        )
      );

    // ── Expenses: sum of inbound invoice grandTotal ─────────────
    const [expenseRow] = await ctx.db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)`.as("total"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, ctx.companyId),
          eq(invoices.direction, "inbound")
        )
      );

    // ── Receivables: outbound invoices in draft/sent status ──────
    const [receivableRow] = await ctx.db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)`.as("total"),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, ctx.companyId),
          eq(invoices.direction, "outbound"),
          sql`${invoices.status} IN ('draft', 'sent')`
        )
      );

    // ── Payables: inbound invoices in draft/sent status ─────────
    const [payableRow] = await ctx.db
      .select({
        total: sql<string>`COALESCE(SUM(${invoices.grandTotal}), 0)`.as("total"),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, ctx.companyId),
          eq(invoices.direction, "inbound"),
          sql`${invoices.status} IN ('draft', 'sent')`
        )
      );

    // ── Contact count ───────────────────────────────────────────
    const [contactRow] = await ctx.db
      .select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(contacts)
      .where(eq(contacts.companyId, ctx.companyId));

    // ── Journal entry line count ────────────────────────────────
    const [journalRow] = await ctx.db
      .select({
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(journalEntryLines)
      .where(eq(journalEntryLines.companyId, ctx.companyId));

    // ── Current fiscal period ───────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const currentPeriod = await ctx.db
      .select()
      .from(fiscalPeriods)
      .where(
        and(
          eq(fiscalPeriods.companyId, ctx.companyId),
          eq(fiscalPeriods.isClosed, false),
          sql`${fiscalPeriods.startDate} <= ${today}`,
          sql`${fiscalPeriods.endDate} >= ${today}`
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const revenue = parseFloat(revenueRow?.total ?? "0");
    const expenses = parseFloat(expenseRow?.total ?? "0");

    return {
      revenue: revenueRow?.total ?? "0",
      revenueCount: revenueRow?.count ?? 0,
      expenses: expenseRow?.total ?? "0",
      expenseCount: expenseRow?.count ?? 0,
      netIncome: (revenue - expenses).toFixed(2),
      receivables: receivableRow?.total ?? "0",
      payables: payableRow?.total ?? "0",
      contactCount: contactRow?.count ?? 0,
      journalLineCount: journalRow?.count ?? 0,
      currentPeriod: currentPeriod
        ? {
            id: currentPeriod.id,
            name: currentPeriod.name,
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
          }
        : null,
    };
  }),
});
