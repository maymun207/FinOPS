import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { columnMappingProfiles } from "./column-mapping-profiles";

/**
 * Import Quarantine — staging table for imported data pending review.
 *
 * When data arrives from CSV uploads, bank APIs, or e-Fatura,
 * it lands here first for validation and user approval before being
 * promoted to the main accounting tables. This protects data integrity
 * and provides an audit trail of all imports.
 */
export const importQuarantine = pgTable("import_quarantine", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — multi-tenant isolation */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Import source: csv | bank_api | e_fatura */
  source: varchar("source", { length: 50 }).notNull(),

  /** Import type: invoice | contact | journal — determines target table on promotion */
  importType: varchar("import_type", { length: 20 }),

  /** Original row data as JSON — preserved exactly as received */
  rawData: jsonb("raw_data").notNull(),

  /** Review status: pending | approved | rejected */
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  /** Validation error or rejection reason — null if no errors */
  errorMessage: text("error_message"),

  /** FK to column_mapping_profiles — which mapping was used for this import */
  mappingProfileId: uuid("mapping_profile_id")
    .references(() => columnMappingProfiles.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
