import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Contacts — Cari Kartlar (customer + vendor unified table).
 *
 * A single table for both customers and vendors simplifies the data model
 * and handles the common Turkish business case where a contact is both
 * a supplier and a client simultaneously.
 */
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — each company manages its own contacts */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Contact role: customer | vendor | both */
  type: varchar("type", { length: 10 }).notNull(),

  /** Display name / trade name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Vergi Kimlik Numarası (VKN) — Turkish tax ID */
  taxId: varchar("tax_id", { length: 50 }),

  /** Primary email */
  email: varchar("email", { length: 255 }),

  /** Primary phone number */
  phone: varchar("phone", { length: 50 }),

  /** Full address — free text */
  address: text("address"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
