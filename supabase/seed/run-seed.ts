/**
 * Seed runner — inserts the full TDHP chart of accounts as system defaults.
 *
 * Usage:
 *   pnpm seed   # inserts template rows with company_id = NULL
 *
 * Template rows are system-wide defaults. When a company is created,
 * accounts can be copied from the template to the company.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { TDHP_ACCOUNTS } from "./tdhp";

async function main() {
  const dbUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error("❌ Set TEST_DATABASE_URL or SUPABASE_DB_URL");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool);

  console.log(
    `🌱 Seeding ${TDHP_ACCOUNTS.length} TDHP accounts as system defaults (company_id = NULL)...`
  );

  // Batch insert with company_id = NULL (system-wide template)
  const values = TDHP_ACCOUNTS.map(
    (a) =>
      `(NULL, '${a.code}', '${a.name.replace(/'/g, "''")}', '${a.accountType}', '${a.normalBalance}', ${a.parentCode ? `'${a.parentCode}'` : "NULL"})`
  ).join(",\n    ");

  await db.execute(sql.raw(`
    INSERT INTO chart_of_accounts (company_id, code, name, account_type, normal_balance, parent_code)
    VALUES
    ${values}
    ON CONFLICT DO NOTHING
  `));

  // Verify
  const count = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM chart_of_accounts WHERE company_id IS NULL`
  );
  const seeded = (count.rows[0] as Record<string, unknown>)["cnt"];

  console.log(`✅ Seeded ${seeded} system-default TDHP accounts`);

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
