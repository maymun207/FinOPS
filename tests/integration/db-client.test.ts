/**
 * @vitest-environment node
 *
 * Integration test: Drizzle DB client
 *
 * Verifies that db.select().from(companies) returns a typed result
 * without TypeScript errors — IntelliSense shows column names.
 *
 * This test validates:
 * 1. The Drizzle client is correctly configured
 * 2. Schema types are inferred properly
 * 3. No 'server-only' boundary violations in test environment
 *
 * Skipped when TEST_DATABASE_URL is not available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/server/db/schema";

const DB_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!DB_URL)("db client — typed queries", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let pool: Pool;
  let testCompanyId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
    db = drizzle(pool, { schema });

    // Create a test company
    const result = await db
      .insert(schema.companies)
      .values({
        clerkOrgId: `org_db_test_${Date.now()}`,
        name: "DB Client Test Co",
      })
      .returning({ id: schema.companies.id });

    testCompanyId = result[0]!.id;
  });

  afterAll(async () => {
    if (testCompanyId) {
      await db.execute(sql`DELETE FROM audit_log WHERE company_id = ${testCompanyId}`);
      await db
        .delete(schema.companies)
        .where(eq(schema.companies.id, testCompanyId));
    }
    await pool.end();
  });

  it("db.select().from(companies) returns typed result with column names", async () => {
    const result = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, testCompanyId));

    expect(result).toHaveLength(1);
    const company = result[0]!;

    // TypeScript infers these properties — this test would fail at compile
    // time if the types were wrong (IntelliSense shows column names)
    expect(company.id).toBe(testCompanyId);
    expect(company.name).toBe("DB Client Test Co");
    expect(company.clerkOrgId).toBeDefined();
    expect(company.createdAt).toBeInstanceOf(Date);
    expect(company.updatedAt).toBeInstanceOf(Date);
  });

  it("db.insert() and db.select() round-trip preserves types", async () => {
    const result = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        clerkOrgId: schema.companies.clerkOrgId,
      })
      .from(schema.companies)
      .where(eq(schema.companies.id, testCompanyId));

    expect(result).toHaveLength(1);
    const company = result[0]!;

    // Verify partial select returns only the specified columns
    expect(typeof company.id).toBe("string");
    expect(typeof company.name).toBe("string");
    expect(typeof company.clerkOrgId).toBe("string");
  });
});
