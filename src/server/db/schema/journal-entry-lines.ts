import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { journalEntries } from "./journal-entries";
import { chartOfAccounts } from "./chart-of-accounts";

/**
 * Journal Entry Lines — Borç/Alacak lines.
 *
 * Each line debits OR credits a specific account.
 * A DB trigger (migration 0003) enforces that for each journal_entry_id,
 * SUM(debit_amount) = SUM(credit_amount).
 *
 * Monetary precision: decimal(15, 2) with default '0' to simplify queries.
 *
 * NOTE: company_id is denormalized here (also reachable via journal_entry_id→journal_entries)
 * because Postgres RLS policies cannot follow FK joins. Must match the parent
 * journal_entry's company_id.
 */
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to journal_entries — cascade on delete */
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id, { onDelete: "cascade" }),

  /**
   * Denormalized company_id for RLS — RLS policies cannot follow FK joins.
   * Must match the parent journal_entry's company_id.
   */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** FK to chart_of_accounts — the account being debited/credited */
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id, { onDelete: "restrict" }),

  /** Debit amount — default '0' when this line is a credit */
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default("0").notNull(),

  /** Credit amount — default '0' when this line is a debit */
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default("0").notNull(),

  /** Optional line-level description */
  description: text("description"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
