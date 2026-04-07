/**
 * @vitest-environment node
 *
 * Integration test: fiscal_periods table
 * Verifies is_closed lifecycle, FK constraints, and cascade delete.
 * Skipped when TEST_DATABASE_URL is not available.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, teardownTestDb, getTestDbUrl, validateConnection, expectDbError, toDbDate } from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schemaTypes from "@/server/db/schema";

// Pre-validate connection — if it fails, getTestDbUrl() returns null → tests skip
await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("fiscal_periods schema", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  const companyIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
  });

  afterEach(async () => {
    // Deleting company cascades to fiscal_periods
    for (const id of companyIds) {
      await db.execute(sql`DELETE FROM companies WHERE id = ${id}`);
    }
    companyIds.length = 0;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("INSERT a fiscal period with is_closed=false, then close it", async () => {
    // Create parent company
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES ('org_fp_lifecycle', 'FP Lifecycle Co')
      RETURNING id
    `);
    const companyId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    companyIds.push(companyId);

    // Create an open period
    const ins = await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date)
      VALUES (${companyId}, '2026-Q1', '2026-01-01', '2026-03-31')
      RETURNING *
    `);
    const period = ins.rows[0] as Record<string, unknown>;
    expect(period["is_closed"]).toBe(false);
    expect(period["closed_at"]).toBeNull();
    expect(period["closed_by"]).toBeNull();

    // Close it
    const upd = await db.execute(sql`
      UPDATE fiscal_periods
      SET is_closed = true, closed_at = NOW(), closed_by = 'user_clerk_123'
      WHERE id = ${period["id"] as string}
      RETURNING *
    `);
    const closed = upd.rows[0] as Record<string, unknown>;
    expect(closed["is_closed"]).toBe(true);
    expect(toDbDate(closed["closed_at"]).getTime()).not.toBeNaN();
    expect(closed["closed_by"]).toBe("user_clerk_123");
  });

  it("enforces FK constraint — inserting with invalid company_id fails", async () => {
    await expectDbError(
      db.execute(sql`
        INSERT INTO fiscal_periods (company_id, name, start_date, end_date)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Invalid', '2026-01-01', '2026-03-31')
      `),
      /foreign key|violates/i
    );
  });

  it("cascades delete — deleting a company removes its periods", async () => {
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES ('org_fp_cascade', 'Cascade Co')
      RETURNING id
    `);
    const coId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    // Don't push to companyIds — we'll delete inline

    await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date)
      VALUES (${coId}, '2026-Full', '2026-01-01', '2026-12-31')
    `);

    await db.execute(sql`DELETE FROM companies WHERE id = ${coId}`);

    const remaining = await db.execute(sql`
      SELECT * FROM fiscal_periods WHERE company_id = ${coId}
    `);
    expect(remaining.rows).toHaveLength(0);
  });
});
