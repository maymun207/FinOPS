/**
 * @vitest-environment node
 *
 * Integration test: fiscal period lock trigger
 * Verifies that the DB trigger trg_fiscal_period_lock prevents
 * inserts/updates on journal_entries when the fiscal period is closed.
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
import type * as schemaTypes from "@/server/db/schema";

await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("fiscal period lock trigger", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  const companyIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
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
   * Helper: create a company and an open fiscal period.
   */
  async function setupCompanyAndPeriod(closed: boolean = false) {
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_fl_${Date.now()}_${Math.random()}`}, 'Fiscal Lock Co')
      RETURNING id
    `);
    const companyId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    companyIds.push(companyId);

    const fp = await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date, is_closed)
      VALUES (${companyId}, '2026-Q1', '2026-01-01', '2026-03-31', ${closed})
      RETURNING id
    `);
    const fpId = (fp.rows[0] as Record<string, unknown>)["id"] as string;

    return { companyId, fpId };
  }

  it("allows journal entry creation in an open fiscal period", async () => {
    const { companyId, fpId } = await setupCompanyAndPeriod(false);

    const result = await db.execute(sql`
      INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
      VALUES (${companyId}, ${fpId}, '2026-02-01', 'manual')
      RETURNING id
    `);

    expect(result.rows).toHaveLength(1);
  });

  it("rejects journal entry creation in a closed fiscal period", async () => {
    const { companyId, fpId } = await setupCompanyAndPeriod(true);

    await expectDbError(
      db.execute(sql`
        INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
        VALUES (${companyId}, ${fpId}, '2026-02-01', 'manual')
      `),
      /closed/i
    );
  });

  it("rejects updating a journal entry to a closed fiscal period", async () => {
    const { companyId, fpId: openFpId } = await setupCompanyAndPeriod(false);

    // Create a closed period in the same company
    const fp2 = await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date, is_closed)
      VALUES (${companyId}, '2025-Q4', '2025-10-01', '2025-12-31', true)
      RETURNING id
    `);
    const closedFpId = (fp2.rows[0] as Record<string, unknown>)["id"] as string;

    // Create entry in open period
    const je = await db.execute(sql`
      INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
      VALUES (${companyId}, ${openFpId}, '2026-02-01', 'manual')
      RETURNING id
    `);
    const jeId = (je.rows[0] as Record<string, unknown>)["id"] as string;

    // Try to move it to the closed period
    await expectDbError(
      db.execute(sql`
        UPDATE journal_entries
        SET fiscal_period_id = ${closedFpId}
        WHERE id = ${jeId}
      `),
      /closed/i
    );
  });

  it("blocks new entries after closing a previously open period", async () => {
    const { companyId, fpId } = await setupCompanyAndPeriod(false);

    // First entry — should succeed
    const je1 = await db.execute(sql`
      INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
      VALUES (${companyId}, ${fpId}, '2026-01-15', 'manual')
      RETURNING id
    `);
    expect(je1.rows).toHaveLength(1);

    // Close the period
    await db.execute(sql`
      UPDATE fiscal_periods SET is_closed = true, closed_at = NOW()
      WHERE id = ${fpId}
    `);

    // Second entry — should fail
    await expectDbError(
      db.execute(sql`
        INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
        VALUES (${companyId}, ${fpId}, '2026-02-15', 'manual')
      `),
      /closed/i
    );
  });

  it("existing entries are NOT affected when period closes (only new inserts blocked)", async () => {
    const { companyId, fpId } = await setupCompanyAndPeriod(false);

    // Insert an entry while period is open
    const je = await db.execute(sql`
      INSERT INTO journal_entries (company_id, fiscal_period_id, entry_date, source_type)
      VALUES (${companyId}, ${fpId}, '2026-01-20', 'manual')
      RETURNING id
    `);
    const jeId = (je.rows[0] as Record<string, unknown>)["id"] as string;
    expect(jeId).toBeDefined();

    // Close the period
    await db.execute(sql`
      UPDATE fiscal_periods SET is_closed = true, closed_at = NOW()
      WHERE id = ${fpId}
    `);

    // Existing entry should still be readable (SELECT is not affected)
    const existing = await db.execute(sql`
      SELECT id, entry_date, source_type FROM journal_entries WHERE id = ${jeId}
    `);
    expect(existing.rows).toHaveLength(1);
    expect((existing.rows[0] as Record<string, unknown>)["id"]).toBe(jeId);
  });
});
