/**
 * @vitest-environment node
 *
 * Integration test: Audit trail verification
 *
 * Verifies that the audit_log trigger captures INSERT, UPDATE, and DELETE
 * operations with correct old_data, new_data, action, and ip_address.
 * Uses invoices table as specified.
 *
 * IMPORTANT PITFALL:
 * - inet_client_addr() returns NULL in serverless environments and in
 *   direct psql/pool connections (like tests). ip_address will be null here.
 * - The audit trigger on journal_entry_lines creates one row per line,
 *   not per journal entry. For a 5-line entry, expect 5 audit_log rows.
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

describe.skipIf(!DB_URL)("audit_log trigger — audit trail verification", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  const companyIds: string[] = [];

  beforeAll(() => {
    const setup = setupTestDb();
    db = setup.db;
  });

  afterEach(async () => {
    for (const id of companyIds) {
      await db.execute(sql`DELETE FROM audit_log WHERE company_id = ${id}`);
      await db.execute(sql`DELETE FROM companies WHERE id = ${id}`);
    }
    companyIds.length = 0;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createCompanyWithInvoice() {
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_audit_${Date.now()}_${Math.random()}`}, 'Audit Test Co')
      RETURNING id
    `);
    const companyId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    companyIds.push(companyId);

    const inv = await db.execute(sql`
      INSERT INTO invoices (company_id, invoice_number, invoice_date, direction, subtotal, kdv_total, grand_total, status)
      VALUES (${companyId}, 'AUD-001', '2026-03-01', 'outbound', '1000.00', '180.00', '1180.00', 'UNPAID')
      RETURNING id
    `);
    const invoiceId = (inv.rows[0] as Record<string, unknown>)["id"] as string;

    return { companyId, invoiceId };
  }

  it("INSERT an invoice → audit_log contains one row with action='INSERT', old_data=null", async () => {
    const { companyId, invoiceId } = await createCompanyWithInvoice();

    const log = await db.execute(sql`
      SELECT action, table_name, record_id, old_data, new_data, ip_address
      FROM audit_log
      WHERE table_name = 'invoices' AND record_id = ${invoiceId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    expect(log.rows).toHaveLength(1);
    const entry = log.rows[0] as Record<string, unknown>;
    expect(entry["action"]).toBe("INSERT");
    expect(entry["table_name"]).toBe("invoices");
    expect(entry["old_data"]).toBeNull();
    expect(entry["new_data"]).toBeTruthy();

    // ip_address is null in test/pooler connections — expected per pitfall docs
    // inet_client_addr() returns null in non-TCP connections
  });

  it("UPDATE the invoice status → audit_log contains row with action='UPDATE', old_data.status='UNPAID'", async () => {
    const { invoiceId } = await createCompanyWithInvoice();

    // Update the status from UNPAID to PAID
    await db.execute(sql`
      UPDATE invoices SET status = 'PAID' WHERE id = ${invoiceId}
    `);

    const log = await db.execute(sql`
      SELECT action, old_data, new_data
      FROM audit_log
      WHERE table_name = 'invoices' AND record_id = ${invoiceId} AND action = 'UPDATE'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    expect(log.rows).toHaveLength(1);
    const entry = log.rows[0] as Record<string, unknown>;
    expect(entry["action"]).toBe("UPDATE");

    const oldData = entry["old_data"] as Record<string, unknown>;
    const newData = entry["new_data"] as Record<string, unknown>;
    expect(oldData["status"]).toBe("UNPAID");
    expect(newData["status"]).toBe("PAID");
  });

  it("DELETE the invoice → audit_log contains row with action='DELETE', new_data=null", async () => {
    const { invoiceId } = await createCompanyWithInvoice();

    await db.execute(sql`DELETE FROM invoices WHERE id = ${invoiceId}`);

    const log = await db.execute(sql`
      SELECT action, old_data, new_data
      FROM audit_log
      WHERE table_name = 'invoices' AND record_id = ${invoiceId} AND action = 'DELETE'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    expect(log.rows).toHaveLength(1);
    const entry = log.rows[0] as Record<string, unknown>;
    expect(entry["action"]).toBe("DELETE");
    expect(entry["old_data"]).toBeTruthy();
    expect(entry["new_data"]).toBeNull();

    const oldData = entry["old_data"] as Record<string, unknown>;
    expect(oldData["invoice_number"]).toBe("AUD-001");
  });

  it("INSERT into audit_log directly → succeeds (admins can query/insert it)", async () => {
    // The audit_log is insert-only via triggers for non-admin users,
    // but the superuser / service_role can insert directly
    const co = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${`org_audit_direct_${Date.now()}`}, 'Direct Audit Co')
      RETURNING id
    `);
    const companyId = (co.rows[0] as Record<string, unknown>)["id"] as string;
    companyIds.push(companyId);

    const result = await db.execute(sql`
      INSERT INTO audit_log (company_id, table_name, record_id, action, user_id)
      VALUES (
        ${companyId},
        'manual_test',
        ${companyId},
        'TEST',
        'admin_user'
      )
      RETURNING id
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as Record<string, unknown>)["id"]).toBeTruthy();
  });
});
