import {
  pgTable,
  uuid,
  varchar,
  date,
  boolean,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Fiscal Periods — time-bounded accounting periods within a company.
 * Used for period-based reporting (monthly, quarterly, yearly).
 * When is_closed = true, no further transactions may be posted to this period.
 */
export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — every period belongs to one company */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Human-readable label, e.g. "2026-Q1", "January 2026" */
  name: varchar("name", { length: 100 }).notNull(),

  /** Inclusive start and end dates of the period */
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  /** When true, no new transactions may be posted to this period */
  isClosed: boolean("is_closed").default(false).notNull(),

  /** Timestamp when the period was closed — null if still open */
  closedAt: timestamp("closed_at", { withTimezone: true }),

  /**
   * Clerk userId of the person who closed the period.
   * Stored as text (not FK) because Clerk manages user identity externally.
   * Null if the period has not been closed.
   */
  closedBy: text("closed_by"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
