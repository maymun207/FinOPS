/**
 * Database barrel — re-exports the Drizzle client, all schema tables,
 * and helper types for use across the application.
 *
 * Usage:
 *   import { db, companies, fiscalPeriods } from "@/server/db";
 *   import type { DbClient } from "@/server/db";
 */
export { db } from "./client";
export * from "./schema";

// Helper types
import type { db } from "./client";

/** The Drizzle client type — useful for dependency injection in tests */
export type DbClient = typeof db;
