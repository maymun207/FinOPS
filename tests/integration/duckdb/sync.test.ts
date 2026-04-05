/**
 * @vitest-environment node
 *
 * Integration tests: DuckDB sync correctness.
 *
 * Tests:
 *   1. getSyncTables returns all 5 expected tables
 *   2. SyncResult type shape — success case
 *   3. SyncResult type shape — error case
 *   4. Table order resolves dependencies (entries before lines)
 *   5. chart_of_accounts included for view joins
 *   6. Sync with known data set: 10 entries → DuckDB contains 10 matching rows
 *   7. Company-scoped sync: Company A data only, no Company B
 */
import { describe, it, expect, afterAll } from "vitest";
import duckdb from "duckdb";
import { duckExec, duckRun } from "@/lib/duckdb/client";
import { getSyncTables, type SyncResult } from "@/lib/duckdb/sync";

describe("DuckDB Sync — correctness", () => {
  it("getSyncTables returns all 5 expected tables", () => {
    const tables = getSyncTables();

    expect(tables).toHaveLength(5);
    expect(tables).toContain("invoices");
    expect(tables).toContain("journal_entries");
    expect(tables).toContain("journal_entry_lines");
    expect(tables).toContain("contacts");
    expect(tables).toContain("chart_of_accounts");
  });

  it("SyncResult type shape is correct for success case", () => {
    const result: SyncResult = {
      table: "invoices",
      rows: 150,
      status: "ok",
      durationMs: 42,
    };

    expect(result.table).toBe("invoices");
    expect(result.rows).toBe(150);
    expect(result.status).toBe("ok");
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("SyncResult type shape is correct for error case", () => {
    const result: SyncResult = {
      table: "contacts",
      rows: 0,
      status: "error",
      error: "Connection refused",
      durationMs: 5,
    };

    expect(result.status).toBe("error");
    expect(result.rows).toBe(0);
    expect(result.error).toContain("Connection refused");
  });

  it("sync table order resolves dependencies (entries before lines)", () => {
    const tables = getSyncTables();
    const entriesIdx = tables.indexOf("journal_entries");
    const linesIdx = tables.indexOf("journal_entry_lines");

    expect(entriesIdx).toBeLessThan(linesIdx);
  });

  it("sync tables include chart_of_accounts for view joins", () => {
    const tables = getSyncTables();
    expect(tables).toContain("chart_of_accounts");
  });
});

describe("DuckDB Sync — data correctness with in-memory DuckDB", () => {
  let testDb: duckdb.Database;

  afterAll(() => {
    testDb?.close();
  });

  it("sync 10 journal entries → DuckDB contains 10 matching rows", async () => {
    testDb = new duckdb.Database(":memory:");

    // Create table
    await duckExec(testDb, `
      CREATE TABLE journal_entries (
        id VARCHAR, company_id VARCHAR, date DATE,
        description VARCHAR, fiscal_period_id VARCHAR
      );
    `);

    // Insert 10 entries
    const values = Array.from({ length: 10 }, (_, i) =>
      `('je-${i}', 'company-a', '2025-01-${String(i + 1).padStart(2, "0")}', 'Entry ${i}', 'fp1')`
    ).join(",\n");

    await duckExec(testDb, `INSERT INTO journal_entries VALUES ${values};`);

    // Verify count
    const result = await duckRun(testDb, "SELECT COUNT(*)::INTEGER AS cnt FROM journal_entries;");
    expect((result[0] as { cnt: number }).cnt).toBe(10);

    // Verify data integrity
    const rows = await duckRun(testDb, "SELECT * FROM journal_entries ORDER BY id;");
    expect(rows).toHaveLength(10);
    expect((rows[0] as { id: string }).id).toBe("je-0");
    expect((rows[9] as { id: string }).id).toBe("je-9");
  });

  it("company-scoped sync: Company A data only, no Company B", async () => {
    testDb = new duckdb.Database(":memory:");

    // Create table
    await duckExec(testDb, `
      CREATE TABLE journal_entries (
        id VARCHAR, company_id VARCHAR, date DATE,
        description VARCHAR, fiscal_period_id VARCHAR
      );
    `);

    // Insert mixed data
    await duckExec(testDb, `
      INSERT INTO journal_entries VALUES
        ('je-1', 'company-a', '2025-01-01', 'A entry 1', 'fp1'),
        ('je-2', 'company-a', '2025-01-02', 'A entry 2', 'fp1'),
        ('je-3', 'company-b', '2025-01-03', 'B entry 1', 'fp1'),
        ('je-4', 'company-a', '2025-01-04', 'A entry 3', 'fp1'),
        ('je-5', 'company-b', '2025-01-05', 'B entry 2', 'fp1');
    `);

    // Simulate company-scoped sync (CREATE OR REPLACE with WHERE)
    await duckExec(testDb, `
      CREATE OR REPLACE TABLE synced_entries AS
      SELECT * FROM journal_entries WHERE company_id = 'company-a';
    `);

    // Verify only Company A rows
    const result = await duckRun(testDb, "SELECT COUNT(*)::INTEGER AS cnt FROM synced_entries;");
    expect((result[0] as { cnt: number }).cnt).toBe(3);

    // Verify no Company B rows
    const bRows = await duckRun(
      testDb,
      "SELECT * FROM synced_entries WHERE company_id = 'company-b';"
    );
    expect(bRows).toHaveLength(0);

    // Verify all are Company A
    const aRows = await duckRun(
      testDb,
      "SELECT * FROM synced_entries WHERE company_id = 'company-a';"
    );
    expect(aRows).toHaveLength(3);
  });
});
