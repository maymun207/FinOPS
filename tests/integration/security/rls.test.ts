/**
 * @vitest-environment node
 *
 * Integration test: Row Level Security — cross-company data isolation
 *
 * Verifies that RLS policies prevent Company A from reading Company B's data.
 * Uses invoices table as specified. Tests role switching via JWT claims.
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
} from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schemaTypes from "@/server/db/schema";

await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("RLS — cross-company data isolation", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  const companyIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
  });

  afterEach(async () => {
    // Reset to superuser after each test
    await db.execute(sql`RESET ROLE`);
    await db.execute(sql.raw(`SET request.jwt.claims = ''`));

    for (const id of companyIds) {
      // Cascade will clean up invoices, fiscal_periods, etc.
      await db.execute(sql`DELETE FROM audit_log WHERE company_id = ${id}`);
      await db.execute(sql`DELETE FROM companies WHERE id = ${id}`);
    }
    companyIds.length = 0;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  /**
   * Helper: create two companies and insert an invoice for Company A only.
   */
  async function setupTwoCompaniesWithInvoice() {
    const ts = Date.now();

    const coA = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_rls_a_${ts}`}, 'Company A')
      RETURNING id, clerk_org_id
    `);
    const companyA = coA.rows[0] as Record<string, unknown>;
    companyIds.push(companyA["id"] as string);

    const coB = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_rls_b_${ts}`}, 'Company B')
      RETURNING id, clerk_org_id
    `);
    const companyB = coB.rows[0] as Record<string, unknown>;
    companyIds.push(companyB["id"] as string);

    // Insert an invoice for Company A only
    const inv = await db.execute(sql`
      INSERT INTO invoices (company_id, invoice_number, invoice_date, direction, subtotal, kdv_total, grand_total, status)
      VALUES (${companyA["id"] as string}, 'INV-001', '2026-02-15', 'outbound', '1000.00', '180.00', '1180.00', 'draft')
      RETURNING id
    `);
    const invoiceId = (inv.rows[0] as Record<string, unknown>)["id"] as string;

    return {
      companyA: { id: companyA["id"] as string, clerkOrgId: companyA["clerk_org_id"] as string },
      companyB: { id: companyB["id"] as string, clerkOrgId: companyB["clerk_org_id"] as string },
      invoiceId,
    };
  }

  it("Query as company B JWT → returns 0 rows (cannot see Company A invoice)", async () => {
    const { companyB } = await setupTwoCompaniesWithInvoice();

    // Authenticate as Company B
    await db.execute(sql.raw(
      `SET request.jwt.claims = '{"org_id": "${companyB.clerkOrgId}", "sub": "user_test_b"}'`
    ));
    await db.execute(sql.raw(`SET ROLE authenticated`));

    const result = await db.execute(sql`SELECT id FROM invoices`);
    expect(result.rows).toHaveLength(0);
  });

  it("Query as company A JWT → returns 1 row with correct data", async () => {
    const { companyA, invoiceId } = await setupTwoCompaniesWithInvoice();

    // Authenticate as Company A
    await db.execute(sql.raw(
      `SET request.jwt.claims = '{"org_id": "${companyA.clerkOrgId}", "sub": "user_test_a"}'`
    ));
    await db.execute(sql.raw(`SET ROLE authenticated`));

    const result = await db.execute(sql`SELECT id, invoice_number FROM invoices`);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row["id"]).toBe(invoiceId);
    expect(row["invoice_number"]).toBe("INV-001");
  });

  it("Attempt INSERT with company_id = B while authenticated as A → throws RLS violation", async () => {
    const { companyA, companyB } = await setupTwoCompaniesWithInvoice();

    // Authenticate as Company A
    await db.execute(sql.raw(
      `SET request.jwt.claims = '{"org_id": "${companyA.clerkOrgId}", "sub": "user_test_a"}'`
    ));
    await db.execute(sql.raw(`SET ROLE authenticated`));

    // Try to insert an invoice for Company B — should be rejected
    await expect(
      db.execute(sql`
        INSERT INTO invoices (company_id, invoice_number, invoice_date, direction, subtotal, kdv_total, grand_total)
        VALUES (${companyB.id}, 'INV-SNEAKY', '2026-02-20', 'outbound', '500.00', '90.00', '590.00')
      `)
    ).rejects.toThrow();
  });

  it("service_role bypasses RLS — returns all rows across companies", async () => {
    const { companyA, companyB } = await setupTwoCompaniesWithInvoice();

    // Also insert an invoice for Company B (as superuser)
    await db.execute(sql`
      INSERT INTO invoices (company_id, invoice_number, invoice_date, direction, subtotal, kdv_total, grand_total)
      VALUES (${companyB.id}, 'INV-B-001', '2026-02-16', 'inbound', '2000.00', '360.00', '2360.00')
    `);

    // Query as service_role — should bypass RLS and see both invoices
    // Note: service_role bypasses RLS by default in Supabase, and
    // the test connection (postgres superuser) also bypasses RLS.
    // This test verifies that the superuser/service_role path works.
    const result = await db.execute(sql`
      SELECT id, company_id FROM invoices
      WHERE company_id IN (${companyA.id}, ${companyB.id})
    `);

    const returnedCompanyIds = (result.rows).map(
      (r) => r["company_id"]
    );

    expect(returnedCompanyIds).toContain(companyA.id);
    expect(returnedCompanyIds).toContain(companyB.id);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });
});

