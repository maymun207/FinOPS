/**
 * Reports tRPC Router — queries DuckDB analytical views.
 *
 * Endpoints:
 *   reports.trialBalance       — Mizan
 *   reports.incomeStatement    — Gelir Tablosu (with summary)
 *   reports.balanceSheet       — Bilanço (with summary)
 *   reports.agingReceivables   — Alacak Yaşlandırma
 *   reports.monthlyCashflow    — Aylık Nakit Akışı
 */
import "server-only";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { getDuckDB } from "@/lib/duckdb/client";
import { duckExec } from "@/lib/duckdb/client";
import { ALL_VIEWS } from "@/lib/duckdb/views";
import {
  queryTrialBalance,
  queryIncomeStatementSummary,
  queryBalanceSheetSummary,
  queryAgingReceivables,
  queryMonthlyCashflow,
} from "@/lib/duckdb/query";

/**
 * Ensure views exist before querying.
 * Idempotent — safe to call multiple times.
 */
async function ensureViewsExist(): Promise<void> {
  const db = getDuckDB();
  for (const view of ALL_VIEWS) {
    await duckExec(db, view.sql);
  }
}

export const reportsRouter = createTRPCRouter({
  trialBalance: companyProcedure.query(async () => {
    const db = getDuckDB();
    await ensureViewsExist();
    return queryTrialBalance(db);
  }),

  incomeStatement: companyProcedure.query(async () => {
    const db = getDuckDB();
    await ensureViewsExist();
    return queryIncomeStatementSummary(db);
  }),

  balanceSheet: companyProcedure.query(async () => {
    const db = getDuckDB();
    await ensureViewsExist();
    return queryBalanceSheetSummary(db);
  }),

  agingReceivables: companyProcedure.query(async () => {
    const db = getDuckDB();
    await ensureViewsExist();
    return queryAgingReceivables(db);
  }),

  monthlyCashflow: companyProcedure.query(async () => {
    const db = getDuckDB();
    await ensureViewsExist();
    return queryMonthlyCashflow(db);
  }),
});
