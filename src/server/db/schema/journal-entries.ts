import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { fiscalPeriods } from "./fiscal-periods";

/**
 * Journal Entries — Yevmiye Defteri header.
 *
 * The backbone of double-entry bookkeeping. Each entry has ≥2 lines
 * (stored in journal_entry_lines) that must balance: Σ debits = Σ credits.
 *
 * A DB trigger (migration 0003) enforces the balance constraint.
 * Another trigger prevents inserts/updates when fiscal_period is closed.
 */
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — multi-tenant isolation */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** FK to fiscal_periods — which period this entry belongs to */
  fiscalPeriodId: uuid("fiscal_period_id")
    .notNull()
    .references(() => fiscalPeriods.id, { onDelete: "restrict" }),

  /** Date of the journal entry */
  entryDate: date("entry_date").notNull(),

  /** Free-text description of the entry */
  description: text("description"),

  /** Origin of the entry: manual | invoice | payment | import */
  sourceType: varchar("source_type", { length: 30 }).notNull(),

  /** FK to the originating record (invoice, payment, etc.) — nullable for manual */
  sourceId: uuid("source_id"),

  /** Clerk userId of the person who created the entry */
  createdBy: text("created_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
