/**
 * PostgreSQL → DuckDB sync logic.
 *
 * Uses DuckDB's postgres_scanner extension to:
 * 1. ATTACH the Supabase PostgreSQL connection as read-only
 * 2. CREATE OR REPLACE tables from PG → DuckDB
 * 3. Supports both full and company-scoped sync
 *
 * Tables synced:
 *   - invoices
 *   - journal_entry_lines
 *   - journal_entries (headers)
 *   - contacts
 *   - chart_of_accounts
 */
import type duckdb from "duckdb";
import { duckExec, duckRun } from "./client";

const SYNC_TABLES = [
  "invoices",
  "journal_entries",
  "journal_entry_lines",
  "contacts",
  "chart_of_accounts",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export interface SyncResult {
  table: string;
  rows: number;
  status: "ok" | "error";
  error?: string;
  durationMs: number;
}

/**
 * Install and load the postgres_scanner extension.
 */
async function installPostgresScanner(db: duckdb.Database): Promise<void> {
  await duckExec(db, "INSTALL postgres_scanner;");
  await duckExec(db, "LOAD postgres_scanner;");
}

/**
 * Attach PostgreSQL as a read-only data source.
 */
async function attachPostgres(
  db: duckdb.Database,
  connStr: string
): Promise<void> {
  // Escape single quotes in connection string
  const escaped = connStr.replace(/'/g, "''");
  await duckExec(
    db,
    `ATTACH '${escaped}' AS pg (TYPE postgres, READ_ONLY);`
  );
}

/**
 * Detach PostgreSQL source (cleanup).
 */
async function detachPostgres(db: duckdb.Database): Promise<void> {
  try {
    await duckExec(db, "DETACH pg;");
  } catch {
    // Ignore if not attached
  }
}

/**
 * Sync a single table from PostgreSQL → DuckDB.
 * Supports company-scoped sync via optional companyId.
 */
async function syncTable(
  db: duckdb.Database,
  table: string,
  companyId?: string
): Promise<SyncResult> {
  const start = Date.now();
  try {
    const whereClause = companyId
      ? `WHERE company_id = '${companyId}'`
      : "";

    await duckExec(
      db,
      `CREATE OR REPLACE TABLE ${table} AS
       SELECT * FROM pg.public.${table}
       ${whereClause};`
    );

    // Get row count
    const rows = await duckRun(
      db,
      `SELECT COUNT(*)::INTEGER AS cnt FROM ${table};`
    );
    const count = (rows[0] as { cnt: number }).cnt;

    return {
      table,
      rows: count,
      status: "ok",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      table,
      rows: 0,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Full sync: copies all tables from PostgreSQL into DuckDB.
 *
 * @param db       DuckDB database instance
 * @param connStr  PostgreSQL connection string (Supabase)
 * @param companyId Optional: scope sync to a single company
 */
export async function syncPostgresToDuckDB(
  db: duckdb.Database,
  connStr: string,
  companyId?: string
): Promise<SyncResult[]> {
  // 1. Install & load postgres_scanner
  await installPostgresScanner(db);

  // 2. Attach PostgreSQL
  await attachPostgres(db, connStr);

  // 3. Sync each table
  const results: SyncResult[] = [];
  for (const table of SYNC_TABLES) {
    const result = await syncTable(db, table, companyId);
    results.push(result);
  }

  // 4. Cleanup: detach
  await detachPostgres(db);

  return results;
}

/**
 * Get the list of tables that will be synced.
 */
export function getSyncTables(): readonly string[] {
  return SYNC_TABLES;
}
