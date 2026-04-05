import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { invoices } from "./invoices";
import { contacts } from "./contacts";

/**
 * Payments — records of money received or paid.
 *
 * Links to invoices for reconciliation and to contacts for reporting.
 * Supports multiple payment methods common in Turkish business.
 */
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — multi-tenant isolation */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** FK to invoices — nullable for payments not tied to a specific invoice */
  invoiceId: uuid("invoice_id")
    .references(() => invoices.id, { onDelete: "set null" }),

  /** FK to contacts — the party paying or being paid */
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "set null" }),

  /** Payment amount */
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),

  /** ISO 4217 currency code */
  currency: varchar("currency", { length: 3 }).notNull().default("TRY"),

  /** Date the payment was made */
  paymentDate: date("payment_date").notNull(),

  /** Payment method: bank_transfer | cash | credit_card | check */
  method: varchar("method", { length: 30 }).notNull(),

  /** External reference number (bank transfer ref, check number, etc.) */
  reference: varchar("reference", { length: 100 }),

  /** Free-text notes */
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
