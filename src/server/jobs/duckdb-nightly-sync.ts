/**
 * duckdb-nightly-sync — Nightly DuckDB sync cron task.
 *
 * Schedule: '0 2 * * *' (05:00 Istanbul = 02:00 UTC)
 *
 * Flow:
 *   1. Create ephemeral in-memory DuckDB instance
 *   2. Install postgres_scanner extension
 *   3. Attach Supabase PostgreSQL (READ_ONLY via service_role conn string)
 *   4. CREATE OR REPLACE 5 financial tables
 *   5. Create 7 analytical views
 *   6. Query all views and cache results in Supabase (cached_report_results)
 *   7. Cache has 1-hour TTL — stale entries are ignored by the tRPC router
 *
 * NOTE: Uses jobEnv + own pg.Pool — does NOT import @/server/db or @/env.ts.
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { getDuckDB, closeDuckDB, duckExec, duckRun } from "@/lib/duckdb/client";
import { syncPostgresToDuckDB } from "@/lib/duckdb/sync";
import { ALL_VIEWS } from "@/lib/duckdb/views";
import { jobEnv } from "./_env";
import { Pool } from "pg";

/**
 * Cache a DuckDB view result into Supabase using raw pg.Pool.
 */
async function cacheReport(
  pool: Pool,
  companyId: string,
  reportType: string,
  data: unknown
): Promise<void> {
  await pool.query(
    `INSERT INTO cached_report_results (company_id, report_type, data, expires_at)
     VALUES ($1, $2, $3::jsonb, now() + interval '1 hour')
     ON CONFLICT (company_id, report_type)
     DO UPDATE SET
       data = EXCLUDED.data,
       expires_at = EXCLUDED.expires_at,
       created_at = now()`,
    [companyId, reportType, JSON.stringify(data)]
  );
}

export const duckdbNightlySync = schedules.task({
  id: "duckdb-nightly-sync",
  cron: "0 2 * * *", // 05:00 Istanbul (UTC+3, no DST)
  run: async () => {
    logger.info("Starting nightly DuckDB sync");

    const pgConnStr = jobEnv.SUPABASE_DB_URL;
    const pool = new Pool({ connectionString: pgConnStr, max: 2 });

    try {
      // 1. Get DuckDB instance (ephemeral in-memory — loses all data on process end)
      const duckDb = getDuckDB();

      // 2-4. Sync all tables from PostgreSQL
      logger.info("Syncing tables from PostgreSQL...");
      const results = await syncPostgresToDuckDB(duckDb, pgConnStr);

      for (const r of results) {
        if (r.status === "ok") {
          logger.info(`Synced ${r.table}: ${String(r.rows)} rows (${String(r.durationMs)}ms)`);
        } else {
          logger.error(`Failed to sync ${r.table}: ${r.error ?? "unknown"}`);
        }
      }

      // 5. Create analytical views
      logger.info("Creating analytical views...");
      for (const view of ALL_VIEWS) {
        try {
          await duckExec(duckDb, view.sql);
          logger.info(`Created view: ${view.name}`);
        } catch (err) {
          logger.error(`Failed to create view ${view.name}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // 6. Query all views and cache results in Supabase
      // Get distinct company IDs from synced data
      const companies = await duckRun(
        duckDb,
        "SELECT DISTINCT company_id FROM journal_entry_lines WHERE company_id IS NOT NULL;"
      );

      const companyIds = (companies as { company_id: string }[]).map(
        (c) => c.company_id
      );

      logger.info(`Caching view results for ${String(companyIds.length)} companies`);

      const viewQueries: { name: string; query: string }[] = [
        { name: "trial_balance", query: "SELECT * FROM v_trial_balance" },
        { name: "income_statement", query: "SELECT * FROM v_income_statement" },
        { name: "balance_sheet", query: "SELECT * FROM v_balance_sheet" },
        { name: "aging_receivables", query: "SELECT * FROM v_aging_receivables" },
        { name: "monthly_cashflow", query: "SELECT * FROM v_monthly_cashflow" },
        { name: "kdv_summary", query: "SELECT * FROM v_kdv_summary" },
      ];

      for (const companyId of companyIds) {
        for (const vq of viewQueries) {
          try {
            const rows = await duckRun(duckDb, `${vq.query};`);
            await cacheReport(pool, companyId, vq.name, rows);
          } catch (err) {
            logger.error(`Failed to cache ${vq.name} for ${companyId}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // Summary
      const successCount = results.filter((r) => r.status === "ok").length;
      const totalRows = results.reduce((sum, r) => sum + r.rows, 0);

      logger.info("DuckDB nightly sync complete", {
        tables_synced: successCount,
        total_rows: totalRows,
        views_created: ALL_VIEWS.length,
        companies_cached: companyIds.length,
      });

      return {
        status: "ok" as const,
        tables_synced: successCount,
        total_rows: totalRows,
        views_created: ALL_VIEWS.length,
        companies_cached: companyIds.length,
        results,
      };
    } catch (err) {
      logger.error("DuckDB sync failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        status: "error" as const,
        error: err instanceof Error ? err.message : String(err),
        tables_synced: 0,
        results: [],
      };
    } finally {
      closeDuckDB();
      await pool.end();
    }
  },
});
