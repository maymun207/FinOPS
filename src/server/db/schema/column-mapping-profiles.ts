import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Column Mapping Profiles — stores user-defined mappings between
 * uploaded file columns and FinOPS target fields.
 *
 * When a user uploads a bank statement or invoice CSV, the system fingerprints
 * the sorted column names (SHA-256) and looks up existing mappings.
 * If found, the mapping is applied automatically; otherwise, the user maps manually
 * and the profile is saved for future use.
 */
export const columnMappingProfiles = pgTable("column_mapping_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** FK to companies — each company has its own mappings */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Human-readable label, e.g. "Garanti Bank Statement" */
  name: varchar("name", { length: 255 }).notNull(),

  /**
   * SHA-256 hash of the sorted column names from the uploaded file.
   * Used for automatic profile matching on subsequent uploads.
   */
  fileFingerprint: text("file_fingerprint"),

  /**
   * The column mapping definition.
   * Shape: Array<{ sourceCol: string; targetField: string }>
   */
  mapping: jsonb("mapping").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
