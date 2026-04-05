import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Shared connection pool — reused across requests in the same process.
 * In serverless environments (Vercel), each instance gets its own pool.
 *
 * Pool configuration:
 * - max: 10 connections (suitable for serverless — Vercel limits to ~10 per process)
 * - idleTimeoutMillis: 20s — free connections quickly in serverless
 * - connectionTimeoutMillis: 10s — fail fast on cold start
 */
const pool = new Pool({
  connectionString: env.SUPABASE_DB_URL,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Drizzle client with full schema awareness.
 * Supports relational queries and type-safe joins.
 * Logging enabled only in development.
 */
export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development",
});
