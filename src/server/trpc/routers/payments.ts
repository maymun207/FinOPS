import "server-only";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { type db } from "@/server/db/client";
import {
  payments,
  invoices,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
} from "@/server/db/schema";

/**
 * Payments tRPC router — records payments and generates journal entries.
 *
 * Payment Journal Entry Logic:
 *   SALES invoice payment received (bank transfer):
 *     DEBIT  102  (Bankalar)    payment.amount
 *     CREDIT 120  (Alıcılar)   payment.amount
 *
 *   PURCHASE invoice payment sent:
 *     DEBIT  320  (Satıcılar)  payment.amount
 *     CREDIT 102  (Bankalar)   payment.amount
 *
 * Invoice status update logic (inside transaction):
 *   SUM(payments.amount) >= invoice.grand_total → PAID
 *   0 < SUM < grand_total → PARTIALLY_PAID
 */
export const paymentsRouter = createTRPCRouter({
  /**
   * List payments for the current company.
   */
  list: companyProcedure
    .input(
      z
        .object({
          invoiceId: z.uuid().optional(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(payments.companyId, ctx.companyId)];
      if (input?.invoiceId) {
        conditions.push(eq(payments.invoiceId, input.invoiceId));
      }

      return ctx.db
        .select()
        .from(payments)
        .where(and(...conditions))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0)
        .orderBy(sql`${payments.paymentDate} DESC`);
    }),

  /**
   * Create a payment — atomically:
   *   1. Insert payment record
   *   2. Generate balanced journal entry (102/120 or 320/102)
   *   3. Update invoice status based on cumulative payments
   */
  create: companyProcedure
    .input(
      z.object({
        invoiceId: z.uuid(),
        amount: z.string().min(1, "Tutar zorunludur"),
        paymentDate: z.string().min(1, "Ödeme tarihi zorunludur"),
        method: z.enum(["bank_transfer", "cash", "credit_card", "check"]),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate amount is a positive number
      const amount = new Decimal(input.amount);
      if (amount.lte(0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ödeme tutarı sıfırdan büyük olmalıdır",
        });
      }

      // Fetch the invoice (must belong to this company)
      const invoice = await ctx.db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fatura bulunamadı",
        });
      }

      if (invoice.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "İptal edilen faturaya ödeme kaydedilemez",
        });
      }
      // ── Overpayment check (Decimal.js comparison) ──────────────
      const [existingSum] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`.as("total"),
        })
        .from(payments)
        .where(eq(payments.invoiceId, input.invoiceId));

      const alreadyPaid = new Decimal(existingSum?.total ?? "0");
      const grandTotal = new Decimal(invoice.grandTotal);
      const wouldPay = alreadyPaid.plus(amount);

      if (wouldPay.gt(grandTotal)) {
        const remaining = grandTotal.minus(alreadyPaid);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ödeme tutarı fatura bakiyesini aşıyor. Kalan: ${remaining.toFixed(2)} ₺`,
        });
      }

      // ── Atomic transaction ────────────────────────────────────
      return ctx.db.transaction(async (tx) => {
        // 1. Insert payment
        const [newPayment] = await tx
          .insert(payments)
          .values({
            companyId: ctx.companyId,
            invoiceId: input.invoiceId,
            contactId: invoice.contactId,
            amount: amount.toFixed(2),
            paymentDate: input.paymentDate,
            method: input.method,
            reference: input.reference,
            notes: input.notes,
          })
          .returning();

        // 2. Generate journal entry for this payment
        if (!invoice.fiscalPeriodId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Faturaya ait mali dönem tanımlı değil — ödeme kaydedilemez",
          });
        }

        await generateJournalFromPayment(
          { tx, companyId: ctx.companyId, userId: ctx.userId },
          {
            paymentId: newPayment!.id,
            direction: invoice.direction,
            amount: amount.toFixed(2),
            paymentDate: input.paymentDate,
            fiscalPeriodId: invoice.fiscalPeriodId,
            method: input.method,
          }
        );

        // 3. Update invoice status based on cumulative payments
        const [totalRow] = await tx
          .select({
            total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`.as(
              "total"
            ),
          })
          .from(payments)
          .where(eq(payments.invoiceId, input.invoiceId));

        const paidTotal = new Decimal(totalRow?.total ?? "0");
        const grandTotal = new Decimal(invoice.grandTotal);

        let newStatus: string;
        if (paidTotal.gte(grandTotal)) {
          newStatus = "paid";
        } else if (paidTotal.gt(0)) {
          newStatus = "partially_paid";
        } else {
          newStatus = invoice.status;
        }

        if (newStatus !== invoice.status) {
          await tx
            .update(invoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(invoices.id, input.invoiceId));
        }

        return {
          payment: newPayment!,
          invoiceStatus: newStatus,
          paidTotal: paidTotal.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
        };
      });
    }),
});

// ── Internal helpers ────────────────────────────────────────────────

interface PaymentJournalCtx {
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  companyId: string;
  userId: string;
}

interface PaymentJournalParams {
  paymentId: string;
  direction: string;
  amount: string;
  paymentDate: string;
  fiscalPeriodId: string;
  method: string;
}

/**
 * Generate balanced journal entry for a payment.
 *
 * SALES (outbound):  DEBIT 102 / CREDIT 120
 * PURCHASE (inbound): DEBIT 320 / CREDIT 102
 */
async function generateJournalFromPayment(
  ctx: PaymentJournalCtx,
  params: PaymentJournalParams
) {
  const resolveAccount = async (code: string): Promise<string> => {
    const acct = await ctx.tx
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.code, code))
      .limit(1)
      .then((rows) => rows[0]);

    if (!acct) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `TDHP hesap kodu bulunamadı: ${code}`,
      });
    }
    return acct.id;
  };

  const methodLabel =
    params.method === "bank_transfer"
      ? "Banka havalesi"
      : params.method === "cash"
      ? "Nakit"
      : params.method === "credit_card"
      ? "Kredi kartı"
      : "Çek";

  let journalLines: {
    accountId: string;
    debitAmount: string;
    creditAmount: string;
    description: string;
  }[];

  if (params.direction === "outbound") {
    // SALES payment received: DEBIT 102 / CREDIT 120
    const [bankaId, alicilarId] = await Promise.all([
      resolveAccount("102"),
      resolveAccount("120"),
    ]);

    journalLines = [
      {
        accountId: bankaId,
        debitAmount: params.amount,
        creditAmount: "0.00",
        description: `Bankalar — tahsilat (${methodLabel})`,
      },
      {
        accountId: alicilarId,
        debitAmount: "0.00",
        creditAmount: params.amount,
        description: `Alıcılar — tahsilat mahsup`,
      },
    ];
  } else {
    // PURCHASE payment sent: DEBIT 320 / CREDIT 102
    const [saticilarId, bankaId] = await Promise.all([
      resolveAccount("320"),
      resolveAccount("102"),
    ]);

    journalLines = [
      {
        accountId: saticilarId,
        debitAmount: params.amount,
        creditAmount: "0.00",
        description: `Satıcılar — ödeme mahsup`,
      },
      {
        accountId: bankaId,
        debitAmount: "0.00",
        creditAmount: params.amount,
        description: `Bankalar — ödeme (${methodLabel})`,
      },
    ];
  }

  // Insert journal entry header
  const [entry] = await ctx.tx
    .insert(journalEntries)
    .values({
      companyId: ctx.companyId,
      fiscalPeriodId: params.fiscalPeriodId,
      entryDate: params.paymentDate,
      description: `Ödeme kaydı — ${methodLabel}`,
      sourceType: "payment",
      sourceId: params.paymentId,
      createdBy: ctx.userId,
    })
    .returning();

  // Insert journal lines
  await ctx.tx.insert(journalEntryLines).values(
    journalLines.map((line, idx) => ({
      journalEntryId: entry!.id,
      companyId: ctx.companyId,
      accountId: line.accountId,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description,
      lineOrder: idx + 1,
    }))
  );
}
