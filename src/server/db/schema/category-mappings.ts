import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { chartOfAccounts } from "./chart-of-accounts";

/**
 * Category Mappings — bridges UI categories to TDHP account codes.
 *
 * When users categorize transactions via the UI (e.g. "Office Supplies"),
 * this table maps that label to the correct TDHP account for journal entries.
 * Each company can customize its own category→account mapping.
 */
export const categoryMappings = pgTable("category_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — each company defines its own mappings */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** UI-facing category label, e.g. "Ofis Malzemeleri", "Kira Gideri" */
  categoryLabel: varchar("category_label", { length: 255 }).notNull(),

  /** FK to chart_of_accounts — the target TDHP account */
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
