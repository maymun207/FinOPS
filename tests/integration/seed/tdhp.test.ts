/**
 * @vitest-environment node
 *
 * Integration test: TDHP seed data integrity
 *
 * Verifies that the TDHP seed inserts correctly with company_id = NULL
 * (system defaults) and validates account types, normal balances,
 * key accounts, and uniqueness.
 *
 * Skipped when TEST_DATABASE_URL is not available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  setupTestDb,
  teardownTestDb,
  getTestDbUrl,
  validateConnection,
} from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schemaTypes from "@/server/db/schema";
import { TDHP_ACCOUNTS } from "../../../supabase/seed/tdhp";

await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("TDHP seed — data integrity", () => {
  let db: NodePgDatabase<typeof schemaTypes>;

  beforeAll(async () => {
    const setup = setupTestDb();
    db = setup.db;

    // Insert all TDHP accounts as system defaults (company_id = NULL)
    const values = TDHP_ACCOUNTS.map(
      (a: (typeof TDHP_ACCOUNTS)[0]) =>
        `(NULL, '${a.code}', '${a.name.replace(/'/g, "''")}', '${a.accountType}', '${a.normalBalance}', ${a.parentCode ? `'${a.parentCode}'` : "NULL"})`
    ).join(",\n    ");

    await db.execute(sql.raw(`
      INSERT INTO chart_of_accounts (company_id, code, name, account_type, normal_balance, parent_code)
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `));
  });

  afterAll(async () => {
    // Cleanup template rows
    await db.execute(
      sql`DELETE FROM audit_log WHERE table_name = 'chart_of_accounts'
          AND company_id IS NULL`
    );
    await db.execute(
      sql`DELETE FROM chart_of_accounts WHERE company_id IS NULL`
    );
    await teardownTestDb();
  });

  it("SELECT COUNT(*) FROM chart_of_accounts WHERE company_id IS NULL returns ≥ 150 rows", async () => {
    const result = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM chart_of_accounts WHERE company_id IS NULL`
    );
    const count = Number((result.rows[0] as Record<string, unknown>)["cnt"]);
    expect(count).toBeGreaterThanOrEqual(150);
  });

  it("Account 100 exists with account_type='asset' and normal_balance='debit'", async () => {
    const result = await db.execute(sql`
      SELECT code, account_type, normal_balance
      FROM chart_of_accounts
      WHERE company_id IS NULL AND code = '100'
    `);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row["account_type"]).toBe("asset");
    expect(row["normal_balance"]).toBe("debit");
  });

  it("Account 391 (Hesaplanan KDV) exists with account_type='liability' and normal_balance='credit'", async () => {
    const result = await db.execute(sql`
      SELECT code, name, account_type, normal_balance
      FROM chart_of_accounts
      WHERE company_id IS NULL AND code = '391'
    `);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row["name"]).toBe("Hesaplanan KDV");
    expect(row["account_type"]).toBe("liability");
    expect(row["normal_balance"]).toBe("credit");
  });

  it("Account 600 (Yurt İçi Satışlar) exists with account_type='revenue' and normal_balance='credit'", async () => {
    const result = await db.execute(sql`
      SELECT code, name, account_type, normal_balance
      FROM chart_of_accounts
      WHERE company_id IS NULL AND code = '600'
    `);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row["name"]).toBe("Yurt İçi Satışlar");
    expect(row["account_type"]).toBe("revenue");
    expect(row["normal_balance"]).toBe("credit");
  });

  it("All account codes starting with '1' have account_type='asset'", async () => {
    const result = await db.execute(sql`
      SELECT code, account_type
      FROM chart_of_accounts
      WHERE company_id IS NULL AND code LIKE '1%' AND account_type != 'asset'
    `);
    // Should return 0 rows — all 1xx codes must be assets
    expect(result.rows).toHaveLength(0);
  });

  it("No duplicate codes exist (per company_id IS NULL)", async () => {
    const result = await db.execute(sql`
      SELECT code, COUNT(*) as cnt
      FROM chart_of_accounts
      WHERE company_id IS NULL
      GROUP BY code
      HAVING COUNT(*) > 1
    `);
    expect(result.rows).toHaveLength(0);
  });
});
