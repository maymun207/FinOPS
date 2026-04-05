import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Companies — the primary tenant entity.
 * Maps 1:1 to a Clerk Organization via clerk_org_id.
 * Every financial entity (invoice, bill, transaction) belongs to a company.
 */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Clerk Organization ID — unique per company, used for RLS policies */
  clerkOrgId: text("clerk_org_id").notNull().unique(),

  /** Display name shown in the UI */
  name: varchar("name", { length: 255 }).notNull(),

  /** Official legal name for invoices and reports */
  legalName: varchar("legal_name", { length: 255 }),

  /** Tax identification number (Vergi Kimlik Numarası in Turkey) */
  taxId: varchar("tax_id", { length: 50 }),

  /** ISO 4217 base currency code — defaults to TRY */
  baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("TRY"),

  /** Whether e-Fatura (Turkish e-invoice) integration is enabled */
  eFaturaEnabled: boolean("e_fatura_enabled").default(false).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
