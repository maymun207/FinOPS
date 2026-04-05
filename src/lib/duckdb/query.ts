/**
 * Type-safe DuckDB query wrapper for reporting views.
 *
 * Provides typed query functions for each reporting view,
 * abstracting raw DuckDB calls into clean TypeScript interfaces.
 */
import type duckdb from "duckdb";
import { duckRun } from "./client";

// ── View result types ──────────────────────────────────────────────

export interface TrialBalanceRow {
  account_code: string;
  account_name: string | null;
  account_type: string | null;
  normal_balance: string | null;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
  net_balance: number;
}

export interface IncomeStatementRow {
  account_type: string;
  account_code: string;
  account_name: string | null;
  net_amount: number;
}

export interface BalanceSheetRow {
  account_type: string;
  account_code: string;
  account_name: string | null;
  balance: number;
}

export interface AgingReceivablesRow {
  contact_id: string;
  contact_name: string | null;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_receivable: number;
}

export interface MonthlyCashflowRow {
  year: number;
  month: number;
  cash_in: number;
  cash_out: number;
  net_flow: number;
}

export interface KdvSummaryRow {
  kdv_rate: number;
  invoice_count: number;
  total_subtotal: number;
  total_kdv: number;
  total_grand: number;
}

export interface ContactLedgerRow {
  company_id: string;
  contact_id: string;
  contact_name: string;
  entry_id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

// ── Query functions ────────────────────────────────────────────────

export async function queryTrialBalance(
  db: duckdb.Database
): Promise<TrialBalanceRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_trial_balance;");
  return rows as unknown as TrialBalanceRow[];
}

export async function queryIncomeStatement(
  db: duckdb.Database
): Promise<IncomeStatementRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_income_statement;");
  return rows as unknown as IncomeStatementRow[];
}

export async function queryBalanceSheet(
  db: duckdb.Database
): Promise<BalanceSheetRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_balance_sheet;");
  return rows as unknown as BalanceSheetRow[];
}

export async function queryAgingReceivables(
  db: duckdb.Database
): Promise<AgingReceivablesRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_aging_receivables;");
  return rows as unknown as AgingReceivablesRow[];
}

export async function queryMonthlyCashflow(
  db: duckdb.Database
): Promise<MonthlyCashflowRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_monthly_cashflow;");
  return rows as unknown as MonthlyCashflowRow[];
}

export async function queryKdvSummary(
  db: duckdb.Database
): Promise<KdvSummaryRow[]> {
  const rows = await duckRun(db, "SELECT * FROM v_kdv_summary;");
  return rows as unknown as KdvSummaryRow[];
}

export async function queryContactLedger(
  db: duckdb.Database,
  contactId?: string
): Promise<ContactLedgerRow[]> {
  const sql = contactId
    ? `SELECT * FROM v_contact_ledger WHERE contact_id = '${contactId}';`
    : "SELECT * FROM v_contact_ledger;";
  const rows = await duckRun(db, sql);
  return rows as unknown as ContactLedgerRow[];
}

/**
 * Summary types for aggregated views
 */
export interface IncomeStatementSummary {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  rows: IncomeStatementRow[];
}

export interface BalanceSheetSummary {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  rows: BalanceSheetRow[];
}

export async function queryIncomeStatementSummary(
  db: duckdb.Database
): Promise<IncomeStatementSummary> {
  const rows = await queryIncomeStatement(db);

  const totalRevenue = rows
    .filter((r) => r.account_type === "revenue")
    .reduce((sum, r) => sum + r.net_amount, 0);

  const totalExpense = rows
    .filter((r) => r.account_type === "expense")
    .reduce((sum, r) => sum + Math.abs(r.net_amount), 0);

  return {
    totalRevenue,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
    rows,
  };
}

export async function queryBalanceSheetSummary(
  db: duckdb.Database
): Promise<BalanceSheetSummary> {
  const rows = await queryBalanceSheet(db);

  const totalAssets = rows
    .filter((r) => r.account_type === "asset")
    .reduce((sum, r) => sum + r.balance, 0);

  const totalLiabilities = rows
    .filter((r) => r.account_type === "liability")
    .reduce((sum, r) => sum + r.balance, 0);

  const totalEquity = rows
    .filter((r) => r.account_type === "equity")
    .reduce((sum, r) => sum + r.balance, 0);

  return { totalAssets, totalLiabilities, totalEquity, rows };
}
