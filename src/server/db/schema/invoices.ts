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
import { contacts } from "./contacts";
import { fiscalPeriods } from "./fiscal-periods";

/**
 * Invoices — invoice header with GİB (Gelir İdaresi Başkanlığı) fields.
 *
 * Supports both inbound (alış) and outbound (satış) invoices.
 * Includes e-Fatura integration fields (gib_uuid, gib_status) for
 * Turkish electronic invoicing compliance.
 *
 * Monetary precision: decimal(15, 2) for all TRY amounts.
 */
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — multi-tenant isolation */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** FK to contacts — the customer/vendor on this invoice */
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "set null" }),

  /** FK to fiscal_periods — which accounting period this belongs to */
  fiscalPeriodId: uuid("fiscal_period_id")
    .references(() => fiscalPeriods.id, { onDelete: "set null" }),

  /** Invoice number — user-defined or auto-generated */
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),

  /** Invoice issue date */
  invoiceDate: date("invoice_date").notNull(),

  /** Payment due date */
  dueDate: date("due_date"),

  /** Direction: inbound (alış faturası) | outbound (satış faturası) */
  direction: varchar("direction", { length: 10 }).notNull(),

  /** ISO 4217 currency code — defaults to TRY */
  currency: varchar("currency", { length: 3 }).notNull().default("TRY"),

  /** Sum of line item subtotals before KDV */
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),

  /** Total KDV amount across all line items */
  kdvTotal: decimal("kdv_total", { precision: 15, scale: 2 }).notNull(),

  /** Grand total = subtotal + kdvTotal */
  grandTotal: decimal("grand_total", { precision: 15, scale: 2 }).notNull(),

  /** Workflow status: draft | sent | paid | cancelled */
  status: varchar("status", { length: 20 }).notNull().default("draft"),

  /** GİB e-Fatura UUID — assigned by the Turkish tax authority. Nullable; only set when e_fatura_enabled */
  gibUuid: varchar("gib_uuid", { length: 36 }),

  /** GİB ETTN (Elektronik Ticaret Takip Numarası). Nullable; only set when e_fatura_enabled */
  gibEttn: varchar("gib_ettn", { length: 36 }),

  /** GİB submission status — e.g. "accepted", "rejected", "pending" */
  gibStatus: varchar("gib_status", { length: 30 }),

  /** Free-text notes */
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
