import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Chart of Accounts — TDHP (Tekdüzen Hesap Planı).
 *
 * Hierarchical account tree following the Turkish uniform chart of accounts.
 * Supports parent→child relationships for drill-down reporting.
 *
 * Rows with company_id = NULL are system-wide TDHP template defaults.
 * When a company is created, accounts can be copied from the template
 * or customized directly.
 */
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * FK to companies — NULL for system-default TDHP template records.
   * Non-null for company-specific customizations.
   */
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "cascade",
  }),

  /** TDHP code, e.g. "100", "320", "320.01" */
  code: varchar("code", { length: 20 }).notNull(),

  /** Human-readable account name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Classification: asset | liability | equity | revenue | expense */
  accountType: varchar("account_type", { length: 20 }).notNull(),

  /**
   * Normal balance side per double-entry bookkeeping:
   * - 'debit'  for asset, expense
   * - 'credit' for liability, equity, revenue
   */
  normalBalance: varchar("normal_balance", { length: 6 }),

  /**
   * Parent account code for template hierarchy (e.g., "100.01" → "100").
   * Used for system-default TDHP accounts where parentId (uuid) is unknown.
   */
  parentCode: varchar("parent_code", { length: 20 }),

  /** Self-referencing FK for hierarchy — null for top-level accounts */
  parentId: uuid("parent_id"),

  /** Soft-disable without deleting — preserves historical data */
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
