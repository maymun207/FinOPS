/**
 * duckdb-nightly-sync — Nightly DuckDB sync cron task.
 *
 * Schedule: '0 2 * * *' (05:00 Istanbul = 02:00 UTC)
 *
 * Flow:
 *   1. Create ephemeral in-memory DuckDB instance
 *   2. Install postgres_scanner extension
 *   3. Attach Supabase PostgreSQL (READ_ONLY)
 *   4. CREATE OR REPLACE 5 financial tables
 *   5. Create 5 analytical views
 *   6. Log results and return sync summary
 */
import { schedules, logger } from "@trigger.dev/sdk/v3";
import { getDuckDB, closeDuckDB } from "@/lib/duckdb/client";
import { syncPostgresToDuckDB } from "@/lib/duckdb/sync";
import { ALL_VIEWS } from "@/lib/duckdb/views";
import { duckExec } from "@/lib/duckdb/client";

export const duckdbNightlySync = schedules.task({
  id: "duckdb-nightly-sync",
  cron: "0 2 * * *", // 05:00 Istanbul (UTC+3, no DST)
  run: async () => {
    logger.info("Starting nightly DuckDB sync");

    const pgConnStr = process.env.DATABASE_URL;
    if (!pgConnStr) {
      logger.error("DATABASE_URL not set — cannot sync");
      return { status: "error", error: "DATABASE_URL not set", tables_synced: 0, results: [] };
    }

    try {
      // 1. Get DuckDB instance (ephemeral in-memory)
      const db = getDuckDB();

      // 2-4. Sync all tables from PostgreSQL
      logger.info("Syncing tables from PostgreSQL...");
      const results = await syncPostgresToDuckDB(db, pgConnStr);

      // Log each table result
      for (const r of results) {
        if (r.status === "ok") {
          logger.info(`Synced ${r.table}: ${r.rows} rows (${r.durationMs}ms)`);
        } else {
          logger.error(`Failed to sync ${r.table}: ${r.error}`);
        }
      }

      // 5. Create analytical views
      logger.info("Creating analytical views...");
      for (const view of ALL_VIEWS) {
        try {
          await duckExec(db, view.sql);
          logger.info(`Created view: ${view.name}`);
        } catch (err) {
          logger.error(`Failed to create view ${view.name}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Summary
      const successCount = results.filter((r) => r.status === "ok").length;
      const totalRows = results.reduce((sum, r) => sum + r.rows, 0);

      logger.info("DuckDB nightly sync complete", {
        tables_synced: successCount,
        total_rows: totalRows,
        views_created: ALL_VIEWS.length,
      });

      return {
        status: "ok" as const,
        tables_synced: successCount,
        total_rows: totalRows,
        views_created: ALL_VIEWS.length,
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
    }
  },
});
