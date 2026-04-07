/**
 * @vitest-environment node
 *
 * Integration test: companies table
 * Verifies INSERT → SELECT round-trip and column types.
 * Skipped when TEST_DATABASE_URL is not available.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, teardownTestDb, getTestDbUrl, validateConnection, toDbDate } from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schemaTypes from "@/server/db/schema";

// Pre-validate connection — if it fails, getTestDbUrl() returns null → tests skip
await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("companies schema", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  const insertedIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
  });

  afterEach(async () => {
    // Clean up inserted rows
    for (const id of insertedIds) {
      await db.execute(sql`DELETE FROM companies WHERE id = ${id}`);
    }
    insertedIds.length = 0;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("INSERT a company and SELECT it back — all columns round-trip correctly", async () => {
    const insertResult = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name, legal_name, tax_id, base_currency, e_fatura_enabled)
      VALUES ('org_test_roundtrip', 'Acme Corp', 'Acme Corporation Ltd.', '1234567890', 'USD', true)
      RETURNING *
    `);

    const inserted = insertResult.rows[0] as Record<string, unknown>;
    insertedIds.push(inserted["id"] as string);

    expect(inserted).toBeDefined();
    expect(inserted["id"]).toBeDefined();
    expect(inserted["clerk_org_id"]).toBe("org_test_roundtrip");
    expect(inserted["name"]).toBe("Acme Corp");
    expect(inserted["legal_name"]).toBe("Acme Corporation Ltd.");
    expect(inserted["tax_id"]).toBe("1234567890");
    expect(inserted["base_currency"]).toBe("USD");
    expect(inserted["e_fatura_enabled"]).toBe(true);
    expect(toDbDate(inserted["created_at"]).getTime()).not.toBeNaN();
    expect(toDbDate(inserted["updated_at"]).getTime()).not.toBeNaN();

    // SELECT by ID
    const selectResult = await db.execute(
      sql`SELECT * FROM companies WHERE id = ${inserted["id"] as string}`
    );
    const selected = selectResult.rows[0] as Record<string, unknown>;
    expect(selected["clerk_org_id"]).toBe("org_test_roundtrip");
    expect(selected["name"]).toBe("Acme Corp");
    expect(selected["e_fatura_enabled"]).toBe(true);
  });

  it("enforces unique constraint on clerk_org_id", async () => {
    const r = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES ('org_unique_check', 'First Company')
      RETURNING id
    `);
    insertedIds.push((r.rows[0] as Record<string, unknown>)["id"] as string);

    await expect(
      db.execute(sql`
        INSERT INTO companies (clerk_org_id, name)
        VALUES ('org_unique_check', 'Duplicate Company')
      `)
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("defaults e_fatura_enabled to false and base_currency to TRY", async () => {
    const result = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES ('org_defaults_check', 'Defaults Test')
      RETURNING id, e_fatura_enabled, base_currency
    `);
    const row = result.rows[0] as Record<string, unknown>;
    insertedIds.push(row["id"] as string);

    expect(row["e_fatura_enabled"]).toBe(false);
    expect(row["base_currency"]).toBe("TRY");
  });
});
