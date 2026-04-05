import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  bigserial,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Audit Log — immutable, append-only record of all data mutations.
 *
 * Design decisions:
 * - No deletedAt, no soft delete — append-only by design
 * - bigserial PK for high-volume sequential writes
 * - old_data is null on INSERT, new_data is null on DELETE
 * - ip_address stored as text (Drizzle has no native inet type)
 *
 * RLS: Append-only. No delete RLS policy intentional.
 * This table must NEVER have a DELETE policy — rows are permanent.
 */
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  /** FK to companies — scopes audit entries per tenant */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Name of the affected table, e.g. "invoices", "transactions" */
  tableName: varchar("table_name", { length: 100 }).notNull(),

  /** Primary key of the affected record */
  recordId: uuid("record_id").notNull(),

  /** The type of mutation */
  action: varchar("action", { length: 10 }).notNull(), // INSERT | UPDATE | DELETE

  /** Snapshot of the row BEFORE the mutation — null on INSERT */
  oldData: jsonb("old_data"),

  /** Snapshot of the row AFTER the mutation — null on DELETE */
  newData: jsonb("new_data"),

  /** Clerk userId of the actor — null for system-generated entries */
  userId: text("user_id"),

  /** Client IP address — stored as text since Drizzle lacks native inet */
  ipAddress: text("ip_address"),

  /** Immutable timestamp — no updatedAt since rows are never modified */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
