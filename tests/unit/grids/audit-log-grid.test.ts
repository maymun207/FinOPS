/**
 * @vitest-environment node
 *
 * AuditLogGrid — data + performance tests.
 *
 * Tests:
 *   1. 50 mock audit rows can be generated without error
 *   2. Large dataset (10K rows) generation completes in < 100ms
 *   3. Audit row structure validates correctly
 */
import { describe, it, expect } from "vitest";

// ── Mock data generator ──────────────────────────────────────────────

interface MockAuditRow {
  id: number;
  companyId: string;
  tableName: string;
  recordId: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const TABLE_NAMES = [
  "invoices",
  "payments",
  "contacts",
  "journal_entries",
  "journal_entry_lines",
  "fiscal_periods",
];

const ACTIONS: Array<"INSERT" | "UPDATE" | "DELETE"> = [
  "INSERT",
  "UPDATE",
  "DELETE",
];

function generateMockAuditRows(count: number): MockAuditRow[] {
  const rows: MockAuditRow[] = [];
  for (let i = 1; i <= count; i++) {
    const action = ACTIONS[i % 3]!;
    const tableName = TABLE_NAMES[i % TABLE_NAMES.length]!;

    rows.push({
      id: i,
      companyId: "00000000-0000-0000-0000-000000000001",
      tableName,
      recordId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      action,
      oldData:
        action !== "INSERT"
          ? { status: "draft", amount: "100.00" }
          : null,
      newData:
        action !== "DELETE"
          ? { status: "paid", amount: "150.00" }
          : null,
      userId: i % 5 === 0 ? null : `user_${i}`,
      ipAddress: `192.168.1.${i % 255}`,
      createdAt: new Date(
        2026,
        2,
        1 + (i % 28),
        i % 24,
        i % 60
      ).toISOString(),
    });
  }
  return rows;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("AuditLogGrid — data generation", () => {
  it("generates 50 mock audit rows without error", () => {
    const rows = generateMockAuditRows(50);
    expect(rows).toHaveLength(50);

    // Each row has the required structure
    for (const row of rows) {
      expect(row.id).toBeGreaterThan(0);
      expect(TABLE_NAMES).toContain(row.tableName);
      expect(ACTIONS).toContain(row.action);
      expect(row.recordId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(row.createdAt).toBeTruthy();
    }
  });

  it("INSERT rows have null oldData and non-null newData", () => {
    const rows = generateMockAuditRows(50);
    const inserts = rows.filter((r) => r.action === "INSERT");
    expect(inserts.length).toBeGreaterThan(0);

    for (const row of inserts) {
      expect(row.oldData).toBeNull();
      expect(row.newData).not.toBeNull();
    }
  });

  it("DELETE rows have non-null oldData and null newData", () => {
    const rows = generateMockAuditRows(50);
    const deletes = rows.filter((r) => r.action === "DELETE");
    expect(deletes.length).toBeGreaterThan(0);

    for (const row of deletes) {
      expect(row.oldData).not.toBeNull();
      expect(row.newData).toBeNull();
    }
  });

  it("UPDATE rows have both oldData and newData", () => {
    const rows = generateMockAuditRows(50);
    const updates = rows.filter((r) => r.action === "UPDATE");
    expect(updates.length).toBeGreaterThan(0);

    for (const row of updates) {
      expect(row.oldData).not.toBeNull();
      expect(row.newData).not.toBeNull();
    }
  });

  it("10,000 rows generated in < 100ms (virtual scrolling data prep)", () => {
    const start = performance.now();
    const rows = generateMockAuditRows(10_000);
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(100);
  });

  it("system-generated entries (userId = null) are correctly marked", () => {
    const rows = generateMockAuditRows(50);
    const systemRows = rows.filter((r) => r.userId === null);
    expect(systemRows.length).toBeGreaterThan(0);

    // Every 5th row should be system-generated
    for (const row of systemRows) {
      expect(row.id % 5).toBe(0);
    }
  });
});
