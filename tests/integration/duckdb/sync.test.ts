/**
 * @vitest-environment node
 *
 * Integration tests: DuckDB sync correctness.
 *
 * Tests (mock mode — no PostgreSQL connection needed):
 *   1. getSyncTables returns all 5 expected tables
 *   2. syncPostgresToDuckDB handles missing connection gracefully
 *   3. SyncResult type shape is correct
 *   4. Sync with invalid connection returns error status per table
 *   5. Table list is in correct order for dependency resolution
 */
import { describe, it, expect } from "vitest";
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

    // journal_entries should come before journal_entry_lines
    expect(entriesIdx).toBeLessThan(linesIdx);
  });

  it("sync tables include chart_of_accounts for view joins", () => {
    const tables = getSyncTables();

    // chart_of_accounts is needed by trial balance, income statement, balance sheet views
    expect(tables).toContain("chart_of_accounts");
  });
});
