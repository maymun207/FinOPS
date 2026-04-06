import "server-only";
import { eq, and, asc, ilike } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { contacts } from "@/server/db/schema";

/**
 * Contacts tRPC router — Cari Kartlar (customer + vendor CRUD).
 *
 * Uses companyProcedure (requires auth + resolved company).
 * All operations are scoped to the current company.
 */
export const contactsRouter = createTRPCRouter({
  /**
   * List all contacts for the current company.
   * Supports optional text search on name.
   */
  list: companyProcedure
    .input(
      z
        .object({
          /** Filter by contact type */
          type: z.enum(["customer", "vendor", "both"]).optional(),
          /** Text search on name */
          search: z.string().optional(),
          /** Pagination limit */
          limit: z.number().min(1).max(500).default(100),
          /** Pagination offset */
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;

      const conditions = [eq(contacts.companyId, ctx.companyId)];

      if (input?.type) {
        conditions.push(eq(contacts.type, input.type));
      }
      if (input?.search) {
        conditions.push(ilike(contacts.name, `%${input.search}%`));
      }

      return ctx.db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(asc(contacts.name))
        .limit(limit)
        .offset(offset);
    }),

  /**
   * Get a single contact by ID.
   * Verifies it belongs to the current company.
   */
  getById: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, input.id), eq(contacts.companyId, ctx.companyId))
        )
        .then((rows) => rows[0] ?? null);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      return row;
    }),

  /**
   * Create a new contact.
   */
  create: companyProcedure
    .input(
      z.object({
        name: z.string().min(1, "İsim zorunludur"),
        type: z.enum(["customer", "vendor", "both"]),
        taxId: z.string().optional(),
        email: z.email().optional().or(z.literal("")),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [contact] = await ctx.db
        .insert(contacts)
        .values({
          companyId: ctx.companyId,
          name: input.name,
          type: input.type,
          taxId: input.taxId ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
        })
        .returning();

      return contact!;
    }),

  /**
   * Update an existing contact.
   * Only provided fields are updated.
   */
  update: companyProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).optional(),
        type: z.enum(["customer", "vendor", "both"]).optional(),
        taxId: z.string().optional(),
        email: z.email().optional().or(z.literal("")),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const existing = await ctx.db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.companyId, ctx.companyId)))
        .then((rows) => rows[0]);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      const [updated] = await ctx.db
        .update(contacts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();

      return updated!;
    }),

  /**
   * Delete a contact.
   * Hard delete — invoices referencing this contact will have contactId set to NULL.
   */
  delete: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.id),
            eq(contacts.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0]);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      await ctx.db.delete(contacts).where(eq(contacts.id, input.id));

      return { success: true };
    }),
});
