import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use the SESSION pooler (port 5432) for migrations.
    // The transaction pooler (port 6543) breaks some DDL operations.
    // Runtime Drizzle client uses SUPABASE_DB_URL (transaction pooler) — that is correct.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    url: process.env.SUPABASE_DB_URL_UNPOOLED ?? process.env.SUPABASE_DB_URL!,
  },
  verbose: true,
  strict: true,
});
