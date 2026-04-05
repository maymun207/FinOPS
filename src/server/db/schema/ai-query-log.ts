import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  bigserial,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * AI Query Log — Virtual CFO audit trail.
 *
 * Append-only log of all AI interactions. Used for:
 * - Audit compliance (who asked what, when)
 * - Usage analytics (tokens, latency)
 * - Model performance monitoring
 *
 * Design: bigserial PK for high-volume sequential writes.
 * No updatedAt — rows are immutable once written.
 */
export const aiQueryLog = pgTable("ai_query_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  /** FK to companies — multi-tenant isolation */
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  /** Clerk userId of the person who made the query */
  userId: text("user_id").notNull(),

  /** The user's natural-language question */
  queryText: text("query_text").notNull(),

  /** The AI-generated response */
  responseText: text("response_text").notNull(),

  /** Model identifier, e.g. "gemini-2.0-flash" */
  model: varchar("model", { length: 50 }).notNull(),

  /** Total tokens consumed (input + output) */
  tokensUsed: integer("tokens_used"),

  /** End-to-end latency in milliseconds */
  latencyMs: integer("latency_ms"),

  /** Immutable timestamp — no updatedAt since rows are never modified */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
