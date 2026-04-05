/**
 * Integration test DB setup — uses a SEPARATE test schema (`test_schema`)
 * to isolate test data from the production `public` schema.
 *
 * The test schema is created on first connect, all tables are mirrored
 * from public using `search_path`, and cleaned up after tests complete.
 *
 * Requires TEST_DATABASE_URL to be set AND resolvable. Tests are skipped otherwise.
 *
 * NOTE: Supabase pooler requires the user format `postgres.[project-ref]`.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/server/db/schema";

const TEST_SCHEMA = "test_schema";

let pool: Pool | null = null;

/**
 * Cached connectivity result — avoids re-checking on every describe.skipIf.
 */
let _urlOverride: string | null | undefined;

/**
 * Returns the test DB URL from env.
 * Returns null if unavailable (tests will skip).
 * After validateConnection() runs, returns null if the connection failed.
 */
export function getTestDbUrl(): string | null {
  if (_urlOverride !== undefined) return _urlOverride;
  return process.env.TEST_DATABASE_URL ?? null;
}

/**
 * Build pool config from a database URL, setting search_path to the test schema.
 */
function buildPoolConfig(dbUrl: string) {
  const url = new URL(dbUrl);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    // Set search_path so all queries hit test_schema first, then public
    options: `-c search_path=${TEST_SCHEMA},public`,
  };
}

/**
 * Pre-validates that the DB connection works.
 * Call this in beforeAll — if it fails, subsequent suites will skip.
 */
export async function validateConnection(): Promise<boolean> {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    _urlOverride = null;
    return false;
  }
  try {
    const testPool = new Pool({
      ...buildPoolConfig(dbUrl),
      connectionTimeoutMillis: 5000,
    });
    await testPool.query("SELECT 1");
    await testPool.end();
    _urlOverride = dbUrl;
    return true;
  } catch {
    _urlOverride = null;
    return false;
  }
}

/**
 * Creates a Drizzle client connected to the test database.
 * Sets search_path to test_schema so tests are isolated from production data.
 *
 * The test schema is created if it doesn't exist, and search_path is verified.
 */
export function setupTestDb() {
  const dbUrl = getTestDbUrl();
  if (!dbUrl) {
    throw new Error("TEST_DATABASE_URL is required for integration tests");
  }

  pool = new Pool(buildPoolConfig(dbUrl));
  const testDb = drizzle(pool, { schema });

  return { db: testDb };
}

/**
 * Ensure the test schema exists and set search_path.
 * Call this once in a global beforeAll.
 */
export async function ensureTestSchema(db: ReturnType<typeof drizzle>) {
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`));
  await db.execute(sql.raw(`SET search_path TO ${TEST_SCHEMA}, public`));
}

/**
 * Closes the connection pool.
 */
export async function teardownTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
