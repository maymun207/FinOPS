/**
 * gib — tRPC router for GIB e-Fatura submission, status, and retry.
 *
 * Endpoints:
 *   gib.submit  — trigger GIB submission job for an invoice
 *   gib.status  — get current gib_status for an invoice
 *   gib.retry   — re-trigger submission for rejected invoices
 */
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { eq, and } from "drizzle-orm";
import { invoices } from "@/server/db/schema";
import { gibFaturaSubmitTask } from "@/server/jobs/gib-fatura-submit";

export const gibRouter = createTRPCRouter({
  /**
   * Submit an invoice to GIB e-Fatura.
   * Triggers the durable submission job via Trigger.dev.
   */
  submit: companyProcedure
    .input(z.object({ invoiceId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice exists and belongs to the company
      const [invoice] = await ctx.db
        .select({
          id: invoices.id,
          gibStatus: invoices.gibStatus,
          direction: invoices.direction,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.companyId, ctx.companyId),
          ),
        );

      if (!invoice) {
        throw new Error("Fatura bulunamadı");
      }

      if (invoice.gibStatus === "accepted") {
        throw new Error("Bu fatura zaten GİB tarafından kabul edildi");
      }

      // Trigger the submission job
      const handle = await gibFaturaSubmitTask.trigger({
        invoiceId: input.invoiceId,
        companyId: ctx.companyId,
      });

      // Update status to pending immediately
      await ctx.db
        .update(invoices)
        .set({ gibStatus: "pending", updatedAt: new Date() })
        .where(eq(invoices.id, input.invoiceId));

      return {
        runId: handle.id,
        status: "pending" as const,
      };
    }),

  /**
   * Get the current GIB status of an invoice.
   */
  status: companyProcedure
    .input(z.object({ invoiceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await ctx.db
        .select({
          id: invoices.id,
          gibUuid: invoices.gibUuid,
          gibEttn: invoices.gibEttn,
          gibStatus: invoices.gibStatus,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.companyId, ctx.companyId),
          ),
        );

      if (!invoice) {
        throw new Error("Fatura bulunamadı");
      }

      return {
        invoiceId: invoice.id,
        gibUuid: invoice.gibUuid,
        gibEttn: invoice.gibEttn,
        gibStatus: invoice.gibStatus as "pending" | "accepted" | "rejected" | null,
      };
    }),

  /**
   * Retry GIB submission for a rejected invoice.
   * Only works if the invoice's gib_status is 'rejected'.
   */
  retry: companyProcedure
    .input(z.object({ invoiceId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await ctx.db
        .select({
          id: invoices.id,
          gibStatus: invoices.gibStatus,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.companyId, ctx.companyId),
          ),
        );

      if (!invoice) {
        throw new Error("Fatura bulunamadı");
      }

      if (invoice.gibStatus !== "rejected") {
        throw new Error("Sadece reddedilen faturalar tekrar gönderilebilir");
      }

      // Re-trigger the submission job
      const handle = await gibFaturaSubmitTask.trigger({
        invoiceId: input.invoiceId,
        companyId: ctx.companyId,
      });

      // Update status to pending
      await ctx.db
        .update(invoices)
        .set({ gibStatus: "pending", updatedAt: new Date() })
        .where(eq(invoices.id, input.invoiceId));

      return {
        runId: handle.id,
        status: "pending" as const,
      };
    }),
});
