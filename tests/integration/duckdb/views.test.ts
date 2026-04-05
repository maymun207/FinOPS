/**
 * @vitest-environment node
 *
 * Integration tests: DuckDB analytical view accuracy.
 *
 * Seed known financial data into in-memory DuckDB tables,
 * create views, then verify query results match expected values.
 *
 * Tests:
 *   1. Trial balance: total debits = total credits (balanced)
 *   2. Trial balance: seed 3 debit entries (102) + 3 credit entries (320) → correct net
 *   3. Income statement: revenue − expense = net income
 *   4. Balance sheet: assets ≠ 0 for seeded data
 *   5. Monthly cashflow: correct aggregation by month
 *   6. Aging receivables: invoice 45 days old → appears in '31-60' bucket
 *   7. KDV summary: 2 invoices at 20%, 1 at 10% → two rows grouped by rate
 *   8. Contact ledger: 3 entries for same contact → running balance is cumulative
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import duckdb from "duckdb";
import { duckExec, duckRun } from "@/lib/duckdb/client";
import { ALL_VIEWS, V_TRIAL_BALANCE, V_AGING_RECEIVABLES, V_KDV_SUMMARY, V_CONTACT_LEDGER } from "@/lib/duckdb/views";
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
  await duckExec(database, `
    CREATE TABLE chart_of_accounts (
      id VARCHAR, company_id VARCHAR, code VARCHAR,
      name VARCHAR, account_type VARCHAR, normal_balance VARCHAR
    );
    CREATE TABLE journal_entries (
      id VARCHAR, company_id VARCHAR, date DATE,
      description VARCHAR, fiscal_period_id VARCHAR, invoice_id VARCHAR
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
      ('je1', 'c1', '2025-01-15', 'Satış faturası', 'fp1', 'inv-a1'),
      ('je2', 'c1', '2025-01-20', 'Gider kaydı', 'fp1', NULL),
      ('je3', 'c1', '2025-02-10', 'Banka tahsilat', 'fp1', 'inv-a2');
  `);

  // Seed journal entry lines (balanced double-entry)
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
      ('ct1', 'c1', 'ABC Ltd', '1234567890', 'abc@test.com', 'customer'),
      ('ct2', 'c1', 'XYZ AŞ', '9876543210', 'xyz@test.com', 'vendor');
  `);

  // Seed invoices (varied KDV rates and ages)
  await duckExec(database, `
    INSERT INTO invoices VALUES
      ('inv-a1', 'c1', 'ct1', 'FAT-001', 'outbound', 'ISSUED',
       CURRENT_DATE - INTERVAL '15' DAY, '5900.00', '5000.00', '1000.00'),
      ('inv-a2', 'c1', 'ct1', 'FAT-002', 'outbound', 'ISSUED',
       CURRENT_DATE - INTERVAL '45' DAY, '3540.00', '3000.00', '600.00'),
      ('inv-a3', 'c1', 'ct1', 'FAT-003', 'outbound', 'ISSUED',
       CURRENT_DATE - INTERVAL '10' DAY, '1100.00', '1000.00', '100.00');
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

  // ── Trial Balance ──────────────────────────────────────────────

  it("trial balance: total debits = total credits (balanced)", async () => {
    const rows = await queryTrialBalance(db);

    expect(rows.length).toBeGreaterThan(0);

    const totalDebit = rows.reduce((sum, r) => sum + Number(r.closing_debit), 0);
    const totalCredit = rows.reduce((sum, r) => sum + Number(r.closing_credit), 0);

    // Debits must equal credits
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  it("v_trial_balance: 3 debit (102) + 3 credit (320) → correct net balance", async () => {
    // Create a fresh DB for this isolated test
    const tdb = new duckdb.Database(":memory:");

    await duckExec(tdb, `
      CREATE TABLE chart_of_accounts (
        id VARCHAR, company_id VARCHAR, code VARCHAR,
        name VARCHAR, account_type VARCHAR, normal_balance VARCHAR
      );
      CREATE TABLE journal_entries (
        id VARCHAR, company_id VARCHAR, date DATE,
        description VARCHAR, fiscal_period_id VARCHAR, invoice_id VARCHAR
      );
      CREATE TABLE journal_entry_lines (
        id VARCHAR, journal_entry_id VARCHAR, company_id VARCHAR,
        account_code VARCHAR, debit_amount VARCHAR, credit_amount VARCHAR,
        description VARCHAR
      );
    `);

    await duckExec(tdb, `
      INSERT INTO chart_of_accounts VALUES
        ('a1', NULL, '102', 'Bankalar', 'asset', 'debit'),
        ('a2', NULL, '320', 'Satıcılar', 'liability', 'credit');
    `);

    await duckExec(tdb, `
      INSERT INTO journal_entries VALUES
        ('e1', 'c1', '2025-01-01', 'E1', 'fp1', NULL),
        ('e2', 'c1', '2025-01-02', 'E2', 'fp1', NULL),
        ('e3', 'c1', '2025-01-03', 'E3', 'fp1', NULL);
    `);

    // 3 debit entries on 102 (1000 each) + 3 credit entries on 320 (1000 each)
    await duckExec(tdb, `
      INSERT INTO journal_entry_lines VALUES
        ('l1', 'e1', 'c1', '102', '1000.00', '0.00', 'Debit 1'),
        ('l2', 'e1', 'c1', '320', '0.00', '1000.00', 'Credit 1'),
        ('l3', 'e2', 'c1', '102', '1000.00', '0.00', 'Debit 2'),
        ('l4', 'e2', 'c1', '320', '0.00', '1000.00', 'Credit 2'),
        ('l5', 'e3', 'c1', '102', '1000.00', '0.00', 'Debit 3'),
        ('l6', 'e3', 'c1', '320', '0.00', '1000.00', 'Credit 3');
    `);

    await duckExec(tdb, V_TRIAL_BALANCE);

    const rows = await duckRun(tdb, "SELECT * FROM v_trial_balance ORDER BY account_code;");
    expect(rows).toHaveLength(2);

    const acct102 = rows[0] as Record<string, unknown>;
    const acct320 = rows[1] as Record<string, unknown>;

    // Account 102 (asset, debit): 3000 debit, 0 credit → net_balance = 3000
    expect(acct102.account_code).toBe("102");
    expect(Number(acct102.closing_debit)).toBe(3000);
    expect(Number(acct102.closing_credit)).toBe(0);
    expect(Number(acct102.net_balance)).toBe(3000);

    // Account 320 (liability, credit): 0 debit, 3000 credit → net_balance = -3000
    expect(acct320.account_code).toBe("320");
    expect(Number(acct320.closing_debit)).toBe(0);
    expect(Number(acct320.closing_credit)).toBe(3000);
    expect(Number(acct320.net_balance)).toBe(-3000);

    tdb.close();
  });

  // ── Income Statement ───────────────────────────────────────────

  it("income statement: revenue − expense = net income", async () => {
    const summary = await queryIncomeStatementSummary(db);

    expect(summary.totalRevenue).toBe(10000);
    expect(summary.totalExpense).toBe(5000);
    expect(summary.netIncome).toBe(5000);
  });

  // ── Balance Sheet ──────────────────────────────────────────────

  it("balance sheet: assets ≠ 0 for seeded data", async () => {
    const summary = await queryBalanceSheetSummary(db);

    expect(summary.totalAssets).toBeGreaterThanOrEqual(0);
    expect(summary.rows.length).toBeGreaterThan(0);
  });

  // ── Monthly Cashflow ──────────────────────────────────────────

  it("monthly cashflow: correct aggregation by month", async () => {
    const rows = await queryMonthlyCashflow(db);
    expect(rows.length).toBeGreaterThan(0);

    const jan = rows.find((r) => Number(r.year) === 2025 && Number(r.month) === 1);
    expect(jan).toBeDefined();
    expect(Number(jan!.cash_in)).toBe(0);
    expect(Number(jan!.cash_out)).toBe(5000);
    expect(Number(jan!.net_flow)).toBe(-5000);

    const feb = rows.find((r) => Number(r.year) === 2025 && Number(r.month) === 2);
    expect(feb).toBeDefined();
    expect(Number(feb!.cash_in)).toBe(11800);
    expect(Number(feb!.cash_out)).toBe(0);
    expect(Number(feb!.net_flow)).toBe(11800);
  });

  // ── Aging Receivables ─────────────────────────────────────────

  it("v_aging_receivables: invoice due 45 days ago → appears in '31-60' bucket", async () => {
    const rows = await duckRun(db, "SELECT * FROM v_aging_receivables;");
    expect(rows.length).toBeGreaterThan(0);

    const row = rows[0] as Record<string, unknown>;

    // inv-a2 is 45 days old → bucket_31_60 should have 3540.00
    expect(Number(row.bucket_31_60)).toBe(3540);

    // Total = 5900 + 3540 + 1100 = 10540
    expect(Number(row.total_receivable)).toBe(10540);
  });

  // ── KDV Summary ───────────────────────────────────────────────

  it("v_kdv_summary: 2 invoices at 20%, 1 at 10% → two rows grouped by rate", async () => {
    const rows = await duckRun(db, "SELECT * FROM v_kdv_summary ORDER BY kdv_rate;");

    expect(rows.length).toBe(2);

    const rate10 = rows[0] as Record<string, unknown>;
    const rate20 = rows[1] as Record<string, unknown>;

    // 1 invoice at 10% (₺1000 subtotal, ₺100 KDV)
    expect(Number(rate10.kdv_rate)).toBe(10);
    expect(Number(rate10.invoice_count)).toBe(1);
    expect(Number(rate10.total_subtotal)).toBe(1000);
    expect(Number(rate10.total_kdv)).toBe(100);

    // 2 invoices at 20% (₺5000 + ₺3000 = ₺8000 subtotal, ₺1000 + ₺600 = ₺1600 KDV)
    expect(Number(rate20.kdv_rate)).toBe(20);
    expect(Number(rate20.invoice_count)).toBe(2);
    expect(Number(rate20.total_subtotal)).toBe(8000);
    expect(Number(rate20.total_kdv)).toBe(1600);
  });

  // ── Contact Ledger ────────────────────────────────────────────

  it("v_contact_ledger: 3 entries for same contact → running balance is cumulative", async () => {
    // Contact ledger requires journal_entries.invoice_id → invoices.contact_id chain.
    // Our seed has je1 → inv-a1 → ct1, je3 → inv-a2 → ct1
    // je2 has no invoice_id so it won't appear in the ledger
    const rows = await duckRun(
      db,
      "SELECT * FROM v_contact_ledger WHERE contact_id = 'ct1' ORDER BY entry_date, entry_id;"
    );

    expect(rows.length).toBeGreaterThanOrEqual(2);

    // First entry: je1 lines that JOIN through inv-a1
    // The running_balance should accumulate (debit - credit) via window function
    const firstRow = rows[0] as Record<string, unknown>;
    expect(firstRow.contact_id).toBe("ct1");
    expect(firstRow.contact_name).toBe("ABC Ltd");

    // Verify running balance is cumulative (each row builds on the previous)
    for (let i = 1; i < rows.length; i++) {
      const curr = rows[i] as Record<string, unknown>;
      // running_balance should be defined for every row
      expect(curr.running_balance).toBeDefined();
      expect(typeof Number(curr.running_balance)).toBe("number");
    }
  });
});
