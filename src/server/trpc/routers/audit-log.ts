import "server-only";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { auditLog } from "@/server/db/schema";

/**
 * Audit Log tRPC router — read-only query for admin users.
 *
 * The audit_log table is append-only (no delete/update).
 * This router only exposes list/getById — no mutations.
 */
export const auditLogRouter = createTRPCRouter({
  /**
   * List audit log entries for the current company.
   * Ordered by created_at descending (newest first).
   * Supports filtering by table_name and action.
   */
  list: companyProcedure
    .input(
      z
        .object({
          tableName: z.string().optional(),
          action: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(auditLog.companyId, ctx.companyId)];

      if (input?.tableName) {
        conditions.push(eq(auditLog.tableName, input.tableName));
      }
      if (input?.action) {
        conditions.push(eq(auditLog.action, input.action));
      }

      const rows = await ctx.db
        .select()
        .from(auditLog)
        .where(and(...conditions))
        .orderBy(desc(auditLog.createdAt))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);

      // Get total count for pagination
      const [countRow] = await ctx.db
        .select({
          count: sql<number>`COUNT(*)::int`.as("count"),
        })
        .from(auditLog)
        .where(and(...conditions));

      return {
        rows,
        total: countRow?.count ?? 0,
      };
    }),

  /**
   * Get a single audit log entry by ID.
   */
  getById: companyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.id, input.id),
            eq(auditLog.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      return entry;
    }),

  /**
   * Get distinct table names for the filter dropdown.
   */
  getTableNames: companyProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ tableName: auditLog.tableName })
      .from(auditLog)
      .where(eq(auditLog.companyId, ctx.companyId))
      .orderBy(auditLog.tableName);

    return rows.map((r) => r.tableName);
  }),
});
