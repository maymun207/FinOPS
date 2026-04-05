import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { invoices } from "./invoices";
import { companies } from "./companies";

/**
 * Invoice Line Items — per-line KDV with CRITICAL numeric precision.
 *
 * Each line carries its own KDV rate and computed amounts.
 * Precision rules (non-negotiable):
 *   quantity:    decimal(12, 4)  — supports fractional units (kg, litre)
 *   unit_price:  decimal(15, 4)  — 4 decimal places for unit pricing
 *   subtotal:    decimal(15, 2)  — quantity × unit_price rounded
 *   kdv_rate:    decimal(5, 2)   — e.g. 20.00, 10.00, 1.00
 *   kdv_amount:  decimal(15, 2)  — subtotal × (kdv_rate / 100)
 *   total:       decimal(15, 2)  — subtotal + kdv_amount
 *
 * NOTE: company_id is denormalized here (also reachable via invoice_id→invoices)
 * because Supabase RLS cannot follow foreign key joins.
 *
 * NOTE: Drizzle returns decimal columns as strings in JavaScript.
 * Always use decimal.js for application-layer arithmetic on these values.
 */
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to invoices — cascade on delete */
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),

  /**
   * Denormalized company_id for RLS — RLS policies cannot follow FK joins.
   * Must match the parent invoice's company_id.
   */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Line item description */
  description: text("description").notNull(),

  /** Quantity — 4 decimal places for fractional units */
  quantity: decimal("quantity", { precision: 12, scale: 4 }).notNull(),

  /** Price per unit — 4 decimal places */
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),

  /** Line subtotal before KDV = quantity × unit_price */
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),

  /** KDV rate as percentage, e.g. 20.00 for %20 KDV */
  kdvRate: decimal("kdv_rate", { precision: 5, scale: 2 }).notNull(),

  /** KDV amount = subtotal × (kdv_rate / 100) */
  kdvAmount: decimal("kdv_amount", { precision: 15, scale: 2 }).notNull(),

  /** Line total = subtotal + kdv_amount */
  total: decimal("total", { precision: 15, scale: 2 }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
