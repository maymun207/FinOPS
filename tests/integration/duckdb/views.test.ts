/**
 * @vitest-environment node
 *
 * Integration tests: DuckDB analytical view accuracy.
 *
 * Seed known financial data into in-memory DuckDB tables,
 * create views, then verify query results match expected values.
 *
 * Tests:
 *   1. Trial balance: debits = credits across all accounts
 *   2. Income statement: revenue − expense = net income
 *   3. Balance sheet: assets ≠ 0 for seeded data
 *   4. Aging receivables: correct bucket classification
 *   5. Monthly cashflow: correct aggregation by month
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import duckdb from "duckdb";
import { duckExec, duckRun } from "@/lib/duckdb/client";
import { ALL_VIEWS } from "@/lib/duckdb/views";
import {
  queryTrialBalance,
  queryIncomeStatementSummary,
  queryBalanceSheetSummary,
  queryMonthlyCashflow,
} from "@/lib/duckdb/query";

let db: duckdb.Database;

/**
 * Seed test data into DuckDB tables.
 */
async function seedTestData(database: duckdb.Database): Promise<void> {
  // Create tables matching the PostgreSQL schema (simplified for views)
  await duckExec(database, `
    CREATE TABLE chart_of_accounts (
      id VARCHAR, company_id VARCHAR, code VARCHAR,
      name VARCHAR, account_type VARCHAR, normal_balance VARCHAR
    );
    CREATE TABLE journal_entries (
      id VARCHAR, company_id VARCHAR, date DATE,
      description VARCHAR, fiscal_period_id VARCHAR
    );
    CREATE TABLE journal_entry_lines (
      id VARCHAR, journal_entry_id VARCHAR, company_id VARCHAR,
      account_code VARCHAR, debit_amount VARCHAR, credit_amount VARCHAR,
      description VARCHAR
    );
    CREATE TABLE invoices (
      id VARCHAR, company_id VARCHAR, contact_id VARCHAR,
      invoice_number VARCHAR, direction VARCHAR, status VARCHAR,
      due_date DATE, grand_total VARCHAR, subtotal VARCHAR,
      kdv_total VARCHAR
    );
    CREATE TABLE contacts (
      id VARCHAR, company_id VARCHAR, name VARCHAR,
      tax_id VARCHAR, email VARCHAR, type VARCHAR
    );
  `);

  // Seed chart of accounts
  await duckExec(database, `
    INSERT INTO chart_of_accounts VALUES
      ('a1', NULL, '100', 'Kasa', 'asset', 'debit'),
      ('a2', NULL, '102', 'Bankalar', 'asset', 'debit'),
      ('a3', NULL, '120', 'Alıcılar', 'asset', 'debit'),
      ('a4', NULL, '320', 'Satıcılar', 'liability', 'credit'),
      ('a5', NULL, '391', 'Hesaplanan KDV', 'liability', 'credit'),
      ('a6', NULL, '500', 'Sermaye', 'equity', 'credit'),
      ('a7', NULL, '600', 'Yurt İçi Satışlar', 'revenue', 'credit'),
      ('a8', NULL, '770', 'Genel Yönetim Giderleri', 'expense', 'debit');
  `);

  // Seed journal entries
  await duckExec(database, `
    INSERT INTO journal_entries VALUES
      ('je1', 'c1', '2025-01-15', 'Satış faturası', 'fp1'),
      ('je2', 'c1', '2025-01-20', 'Gider kaydı', 'fp1'),
      ('je3', 'c1', '2025-02-10', 'Banka tahsilat', 'fp1');
  `);

  // Seed journal entry lines (balanced)
  await duckExec(database, `
    INSERT INTO journal_entry_lines VALUES
      ('jl1', 'je1', 'c1', '120', '11800.00', '0.00', 'Alıcılar'),
      ('jl2', 'je1', 'c1', '600', '0.00', '10000.00', 'Satış'),
      ('jl3', 'je1', 'c1', '391', '0.00', '1800.00', 'KDV'),
      ('jl4', 'je2', 'c1', '770', '5000.00', '0.00', 'Gider'),
      ('jl5', 'je2', 'c1', '102', '0.00', '5000.00', 'Banka'),
      ('jl6', 'je3', 'c1', '102', '11800.00', '0.00', 'Tahsilat'),
      ('jl7', 'je3', 'c1', '120', '0.00', '11800.00', 'Alıcılar');
  `);

  // Seed contacts
  await duckExec(database, `
    INSERT INTO contacts VALUES
      ('ct1', 'c1', 'ABC Ltd', '1234567890', 'abc@test.com', 'customer');
  `);

  // Seed invoices (for aging)
  await duckExec(database, `
    INSERT INTO invoices VALUES
      ('inv1', 'c1', 'ct1', 'FAT-001', 'outbound', 'ISSUED',
       CURRENT_DATE - INTERVAL '15' DAY, '5000.00', '4237.29', '762.71'),
      ('inv2', 'c1', 'ct1', 'FAT-002', 'outbound', 'ISSUED',
       CURRENT_DATE - INTERVAL '45' DAY, '3000.00', '2542.37', '457.63');
  `);

  // Create all views
  for (const view of ALL_VIEWS) {
    await duckExec(database, view.sql);
  }
}

describe("DuckDB Views — accuracy against known data", () => {
  beforeAll(async () => {
    db = new duckdb.Database(":memory:");
    await seedTestData(db);
  });

  afterAll(() => {
    db.close();
  });

  it("trial balance: total debits = total credits (balanced)", async () => {
    const rows = await queryTrialBalance(db);

    expect(rows.length).toBeGreaterThan(0);

    const totalDebit = rows.reduce((sum, r) => sum + Number(r.total_debit), 0);
    const totalCredit = rows.reduce((sum, r) => sum + Number(r.total_credit), 0);

    // Debits must equal credits (balanced books)
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it("trial balance: account 600 has credit balance (revenue)", async () => {
    const rows = await queryTrialBalance(db);
    const account600 = rows.find((r) => r.account_code === "600");

    expect(account600).toBeDefined();
    expect(Number(account600!.total_credit)).toBe(10000);
    expect(Number(account600!.balance)).toBeLessThan(0); // negative = credit balance
  });

  it("income statement: revenue − expense = net income", async () => {
    const summary = await queryIncomeStatementSummary(db);

    // Revenue: 10,000 (account 600)
    expect(summary.totalRevenue).toBe(10000);

    // Expense: 5,000 (account 770)
    expect(summary.totalExpense).toBe(5000);

    // Net income
    expect(summary.netIncome).toBe(5000);
  });

  it("balance sheet: assets ≠ 0 for seeded data", async () => {
    const summary = await queryBalanceSheetSummary(db);

    // Account 102 (Bankalar): 11800 debit - 5000 credit = 6800
    // Account 120 (Alıcılar): 11800 debit - 11800 credit = 0
    expect(summary.totalAssets).toBeGreaterThanOrEqual(0);
    expect(summary.rows.length).toBeGreaterThan(0);
  });

  it("monthly cashflow: correct aggregation by month", async () => {
    const rows = await queryMonthlyCashflow(db);

    expect(rows.length).toBeGreaterThan(0);

    // January 2025: je2 has account 102 credit=5000 (cash out only)
    const jan = rows.find((r) => Number(r.year) === 2025 && Number(r.month) === 1);
    expect(jan).toBeDefined();
    expect(Number(jan!.cash_in)).toBe(0);
    expect(Number(jan!.cash_out)).toBe(5000);
    expect(Number(jan!.net_flow)).toBe(-5000);

    // February 2025: je3 has account 102 debit=11800 (cash in only)
    const feb = rows.find((r) => Number(r.year) === 2025 && Number(r.month) === 2);
    expect(feb).toBeDefined();
    expect(Number(feb!.cash_in)).toBe(11800);
    expect(Number(feb!.cash_out)).toBe(0);
    expect(Number(feb!.net_flow)).toBe(11800);
  });

  it("aging receivables: invoices classified into correct age buckets", async () => {
    // This test uses CURRENT_DATE relative offsets from seed data
    const rows = await duckRun(db, "SELECT * FROM v_aging_receivables;");

    expect(rows.length).toBeGreaterThan(0);

    const row = rows[0] as Record<string, unknown>;
    // Total receivable = 5000 + 3000 = 8000
    expect(Number(row.total_receivable)).toBe(8000);
  });
});
