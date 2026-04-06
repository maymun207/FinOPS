/**
 * Reports tRPC Router — reads from cached DuckDB analytical views.
 *
 * Architecture:
 *   Next.js API → tRPC → Supabase (cached_report_results) → frontend
 *   Trigger.dev nightly sync → DuckDB → cache results in Supabase
 *
 * The tRPC router reads from the cache with a 1-hour TTL.
 * If cache is stale/missing, it returns null and the frontend
 * can trigger a manual sync via the jobs router.
 *
 * Endpoints:
 *   reports.trialBalance       — Mizan
 *   reports.incomeStatement    — Gelir Tablosu (with summary)
 *   reports.balanceSheet       — Bilanço (with summary)
 *   reports.agingReceivables   — Alacak Yaşlandırma
 *   reports.monthlyCashflow    — Aylık Nakit Akışı
 *   reports.kdvSummary         — KDV Özeti
 *   reports.contactLedger      — Cari Hesap
 */
import "server-only";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

/**
 * Read a cached report from Supabase.
 * Returns the data if the cache entry exists and hasn't expired, else null.
 */
async function readCachedReport<T>(
  companyId: string,
  reportType: string
): Promise<T | null> {
  const result = await db.execute(
    sql`SELECT data FROM cached_report_results
        WHERE company_id = ${companyId}
          AND report_type = ${reportType}
          AND expires_at > now()
        LIMIT 1`
  );

  const rows = result.rows as { data: T }[];
  if (rows.length === 0) return null;
  return rows[0]!.data;
}

export const reportsRouter = createTRPCRouter({
  trialBalance: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "trial_balance");
  }),

  incomeStatement: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "income_statement");
  }),

  balanceSheet: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "balance_sheet");
  }),

  agingReceivables: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "aging_receivables");
  }),

  monthlyCashflow: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "monthly_cashflow");
  }),

  kdvSummary: companyProcedure.query(async ({ ctx }) => {
    return readCachedReport(ctx.companyId, "kdv_summary");
  }),

  contactLedger: companyProcedure
    .input(z.object({ contactId: z.uuid().optional() }).optional())
    .query(async ({ ctx }) => {
      return readCachedReport(ctx.companyId, "contact_ledger");
    }),
});
