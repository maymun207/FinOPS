/**
 * DuckDB connection factory — singleton for Trigger.dev job context.
 *
 * Uses in-memory database for ephemeral job runs.
 * Nightly sync always rebuilds from PostgreSQL — no state needed between runs.
 */
import duckdb from "duckdb";

let _db: duckdb.Database | null = null;

/**
 * Get or create the DuckDB database instance.
 * For Trigger.dev jobs: uses /tmp (ephemeral per job run).
 * For tests: uses :memory:.
 */
export function getDuckDB(path?: string): duckdb.Database {
  _db ??= new duckdb.Database(path ?? ":memory:");
  return _db;
}

/**
 * Close the DuckDB database and reset the singleton.
 */
export function closeDuckDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Run a SQL statement on the DuckDB database.
 * Returns a promise that resolves with the result rows.
 */
export function duckRun(
  db: duckdb.Database,
  sql: string
): Promise<duckdb.TableData> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err: Error | null, rows: duckdb.TableData) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Execute a SQL statement that doesn't return rows (CREATE, INSERT, etc.).
 */
export function duckExec(
  db: duckdb.Database,
  sql: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
