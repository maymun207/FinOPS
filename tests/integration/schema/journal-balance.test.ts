/**
 * @vitest-environment node
 *
 * Integration test: journal_entry_lines balance constraint trigger
 *
 * The trigger is DEFERRABLE INITIALLY DEFERRED — it fires at COMMIT time,
 * not after each individual INSERT. This means:
 *   - Lines can be inserted one-by-one within a transaction
 *   - The balance check happens when the transaction commits
 *   - An unbalanced transaction will fail on COMMIT
 *
 * Skipped when TEST_DATABASE_URL is not available.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import {
  setupTestDb,
  teardownTestDb,
  getTestDbUrl,
  validateConnection,
  expectDbError,
} from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type * as schemaTypes from "@/server/db/schema";

await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("journal_entry_lines balance constraint", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  let pgPool: Pool;
  const companyIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
    pgPool = setup.pool;
  });

  afterEach(async () => {
    for (const id of companyIds) {
      await db.execute(sql`DELETE FROM companies WHERE id = ${id}`);
    }
    companyIds.length = 0;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  /**
   * Helper: create a company → fiscal_period → chart_of_accounts accounts → journal_entry
   * Returns IDs needed for inserting journal_entry_lines.
   */
  async function setupJournalEntry() {
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_jb_${Date.now()}_${Math.random()}`}, 'Balance Test Co')
      RETURNING id
    `);
    const companyId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    companyIds.push(companyId);

    const fp = await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date)
      VALUES (${companyId}, '2026-Q1', '2026-01-01', '2026-03-31')
      RETURNING id
    `);
    const fpId = (fp.rows[0] as Record<string, unknown>)["id"] as string;

    const acc1 = await db.execute(sql`
      INSERT INTO chart_of_accounts (company_id, code, name, account_type)
      VALUES (${companyId}, '100', 'Kasa', 'asset')
      RETURNING id
    `);
    const accountId1 = (acc1.rows[0] as Record<string, unknown>)["id"] as string;

    const acc2 = await db.execute(sql`
      INSERT INTO chart_of_accounts (company_id, code, name, account_type)
      VALUES (${companyId}, '320', 'Saticilar', 'liability')
      RETURNING id
    `);
    const accountId2 = (acc2.rows[0] as Record<string, unknown>)["id"] as string;

    const je = await db.execute(sql`
      INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
      VALUES (${companyId}, ${fpId}, '2026-02-15', 'manual')
      RETURNING id
    `);
    const jeId = (je.rows[0] as Record<string, unknown>)["id"] as string;

    return { companyId, fpId, accountId1, accountId2, jeId };
  }

  it("accepts balanced journal entry lines inserted in one statement", async () => {
    const { companyId, accountId1, accountId2, jeId } = await setupJournalEntry();

    // Insert two balanced lines in one statement
    const result = await db.execute(sql`
      INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_id, debit_amount, credit_amount)
      VALUES
        (${jeId}, ${companyId}, ${accountId1}, 1000.00, 0),
        (${jeId}, ${companyId}, ${accountId2}, 0, 1000.00)
      RETURNING id
    `);

    expect(result.rows).toHaveLength(2);
  }, 15_000);

  it("INSERT first line only (deferred trigger) succeeds; commit unbalanced throws", async () => {
    const { companyId, accountId1, accountId2, jeId } = await setupJournalEntry();

    // With DEFERRABLE INITIALLY DEFERRED, inserting the first line
    // within an explicit transaction succeeds — check defers to COMMIT.
    // When we try to commit with only one side, it must throw.
    // NOTE: must use raw pg Client because Drizzle's db.execute() doesn't
    // support multi-statement strings with explicit BEGIN/COMMIT.
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, $3, 500.00, 0)`,
        [jeId, companyId, accountId1]
      );
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, $3, 0, 300.00)`,
        [jeId, companyId, accountId2]
      );
      await expectDbError(
        client.query("COMMIT"),
        /unbalanced/i
      );
    } finally {
      // If COMMIT threw, the transaction is already rolled back — just release
      try { await client.query("ROLLBACK"); } catch { /* already done */ }
      client.release();
    }
  });

  it("rejects unbalanced journal entry lines on commit", async () => {
    const { companyId, accountId1, accountId2, jeId } = await setupJournalEntry();

    // DEFERRABLE trigger: balance check happens at commit time.
    // Inserting unbalanced lines will fail when the implicit transaction commits.
    await expectDbError(
      db.execute(sql`
        INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_id, debit_amount, credit_amount)
        VALUES
          (${jeId}, ${companyId}, ${accountId1}, 1000.00, 0),
          (${jeId}, ${companyId}, ${accountId2}, 0, 500.00)
      `),
      /unbalanced/i
    );
  });

  it("rejects an update that unbalances an existing entry", async () => {
    const { companyId, accountId1, accountId2, jeId } = await setupJournalEntry();

    // Insert balanced first
    const ins = await db.execute(sql`
      INSERT INTO journal_entry_lines (journal_entry_id, company_id, account_id, debit_amount, credit_amount)
      VALUES
        (${jeId}, ${companyId}, ${accountId1}, 500.00, 0),
        (${jeId}, ${companyId}, ${accountId2}, 0, 500.00)
      RETURNING id
    `);
    const lineId = (ins.rows[0] as Record<string, unknown>)["id"] as string;

    // Update debit to create imbalance — should fail at commit
    await expectDbError(
      db.execute(sql`
        UPDATE journal_entry_lines
        SET debit_amount = 999.00
        WHERE id = ${lineId}
      `),
      /unbalanced/i
    );
  });
});
