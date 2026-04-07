import "server-only";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { type db } from "@/server/db/client";
import {
  invoices,
  invoiceLineItems,
  contacts,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  fiscalPeriods,
} from "@/server/db/schema";
import { calculateLineItem } from "@/lib/finance/kdv";

// Re-use Decimal config from kdv.ts
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Invoices tRPC router — Fatura operations.
 *
 * Handles full invoice lifecycle: create (with line items + auto-journal),
 * list, getById, and delete (cascading to journal entries).
 *
 * CRITICAL: Invoice creation is a single Drizzle transaction.
 * All INSERT calls use `tx`, not `db`, to ensure atomicity.
 */
export const invoicesRouter = createTRPCRouter({
  /**
   * List all invoices for the current company.
   * Joins contact name for display.
   */
  list: companyProcedure
    .input(
      z
        .object({
          direction: z.enum(["inbound", "outbound"]).optional(),
          status: z
            .enum(["draft", "sent", "paid", "cancelled"])
            .optional(),
          limit: z.number().min(1).max(500).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;
      const offset = input?.offset ?? 0;

      const conditions = [eq(invoices.companyId, ctx.companyId)];

      if (input?.direction) {
        conditions.push(eq(invoices.direction, input.direction));
      }
      if (input?.status) {
        conditions.push(eq(invoices.status, input.status));
      }

      return ctx.db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate: invoices.invoiceDate,
          dueDate: invoices.dueDate,
          direction: invoices.direction,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          kdvTotal: invoices.kdvTotal,
          grandTotal: invoices.grandTotal,
          status: invoices.status,
          contactName: contacts.name,
          contactId: invoices.contactId,
          notes: invoices.notes,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.invoiceDate))
        .limit(limit)
        .offset(offset);
    }),

  /**
   * Get a single invoice by ID with all line items.
   */
  getById: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate: invoices.invoiceDate,
          dueDate: invoices.dueDate,
          direction: invoices.direction,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          kdvTotal: invoices.kdvTotal,
          grandTotal: invoices.grandTotal,
          status: invoices.status,
          contactId: invoices.contactId,
          contactName: contacts.name,
          fiscalPeriodId: invoices.fiscalPeriodId,
          notes: invoices.notes,
          gibUuid: invoices.gibUuid,
          gibEttn: invoices.gibEttn,
          gibStatus: invoices.gibStatus,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0] ?? null);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const lines = await ctx.db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoice.id))
        .orderBy(asc(invoiceLineItems.createdAt));

      return { ...invoice, lines };
    }),

  /**
   * Create an invoice with line items and auto-generate journal entries.
   *
   * ATOMICITY: Entire operation runs inside db.transaction(async (tx) => { ... }).
   * All INSERT calls use `tx`, not `db`. If any step fails, everything rolls back.
   *
   * Workflow:
   *   1. Server-side recalculate all line item amounts using decimal.js
   *   2. Compute invoice totals from line items using Decimal (no JS arithmetic)
   *   3. Validate fiscal period is open
   *   4. INSERT invoice header
   *   5. INSERT line items
   *   6. INSERT journal entry + lines (auto-journal)
   */
  create: companyProcedure
    .input(
      z.object({
        invoiceNumber: z.string().min(1, "Fatura numarası zorunludur"),
        invoiceDate: z.string().min(1, "Fatura tarihi zorunludur"),
        dueDate: z.string().optional(),
        direction: z.enum(["inbound", "outbound"]),
        contactId: z.uuid().optional(),
        notes: z.string().optional(),
        lines: z
          .array(
            z.object({
              description: z.string().min(1, "Açıklama zorunludur"),
              quantity: z.string().min(1),
              unitPrice: z.string().min(1),
              kdvRate: z.string().min(1),
            })
          )
          .min(1, "En az 1 kalem eklenmelidir"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ── 1. Recalculate all line items server-side (decimal.js) ─────
      const computedLines = input.lines.map((line) => {
        const computed = calculateLineItem(
          line.quantity,
          line.unitPrice,
          line.kdvRate
        );
        return {
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          kdvRate: line.kdvRate,
          subtotal: computed.subtotal,
          kdvAmount: computed.kdvAmount,
          total: computed.total,
        };
      });

      // ── 2. Compute invoice totals using Decimal.js (NO native JS arithmetic) ──
      let invoiceSubtotal = new Decimal(0);
      let invoiceKdvTotal = new Decimal(0);
      let invoiceGrandTotal = new Decimal(0);

      for (const line of computedLines) {
        invoiceSubtotal = invoiceSubtotal.plus(line.subtotal);
        invoiceKdvTotal = invoiceKdvTotal.plus(line.kdvAmount);
        invoiceGrandTotal = invoiceGrandTotal.plus(line.total);
      }

      // ── 3. Resolve current open fiscal period ─────────────────────
      const currentPeriod = await ctx.db
        .select({ id: fiscalPeriods.id, isClosed: fiscalPeriods.isClosed })
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.companyId, ctx.companyId),
            eq(fiscalPeriods.isClosed, false)
          )
        )
        .orderBy(desc(fiscalPeriods.startDate))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!currentPeriod) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Açık bir mali dönem bulunamadı. Fatura oluşturmak için bir dönem açılmalı.",
        });
      }

      // ── 4–6. Single transaction: invoice + line items + journal ────
      const result = await ctx.db.transaction(async (tx) => {
        // 4. Insert invoice header
        const [invoice] = await tx
          .insert(invoices)
          .values({
            companyId: ctx.companyId,
            contactId: input.contactId ?? null,
            fiscalPeriodId: currentPeriod.id,
            invoiceNumber: input.invoiceNumber,
            invoiceDate: input.invoiceDate,
            dueDate: input.dueDate ?? null,
            direction: input.direction,
            subtotal: invoiceSubtotal.toFixed(2),
            kdvTotal: invoiceKdvTotal.toFixed(2),
            grandTotal: invoiceGrandTotal.toFixed(2),
            notes: input.notes ?? null,
          })
          .returning();

        if (!invoice) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create invoice",
          });
        }

        // 5. Insert line items
        const lineValues = computedLines.map((line) => ({
          invoiceId: invoice.id,
          companyId: ctx.companyId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          kdvRate: line.kdvRate,
          subtotal: line.subtotal,
          kdvAmount: line.kdvAmount,
          total: line.total,
        }));

        await tx.insert(invoiceLineItems).values(lineValues);

        // 6. Auto-generate journal entry
        await generateJournalFromInvoice(
          { tx, companyId: ctx.companyId, userId: ctx.userId },
          {
            invoiceId: invoice.id,
            direction: input.direction,
            invoiceDate: input.invoiceDate,
            subtotal: invoiceSubtotal.toFixed(2),
            kdvTotal: invoiceKdvTotal.toFixed(2),
            grandTotal: invoiceGrandTotal.toFixed(2),
            fiscalPeriodId: currentPeriod.id,
            description: `Fatura: ${input.invoiceNumber}`,
          }
        );

        return invoice;
      });

      return result;
    }),

  /**
   * Delete an invoice.
   * Cascading: invoice_line_items are deleted by FK cascade.
   * Also deletes the auto-generated journal entry.
   * Runs in a single transaction.
   */
  delete: companyProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.companyId, ctx.companyId)
          )
        )
        .then((rows) => rows[0]);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      await ctx.db.transaction(async (tx) => {
        // Delete auto-generated journal entries (sourceType='invoice', sourceId=invoiceId)
        const relatedEntries = await tx
          .select({ id: journalEntries.id })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.sourceId, input.id),
              eq(journalEntries.sourceType, "invoice"),
              eq(journalEntries.companyId, ctx.companyId)
            )
          );

        for (const entry of relatedEntries) {
          // journal_entry_lines cascade by FK
          await tx
            .delete(journalEntries)
            .where(eq(journalEntries.id, entry.id));
        }

        // Delete invoice (line items cascade by FK)
        await tx.delete(invoices).where(eq(invoices.id, input.id));
      });

      return { success: true };
    }),
});

// ── Journal entry auto-generation ─────────────────────────────────────

/**
 * Transaction-aware DB handle. Uses `tx` (transaction client), not `db`.
 */
type TxHandle = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface JournalCtx {
  tx: TxHandle;
  companyId: string;
  userId: string;
}

interface JournalFromInvoiceParams {
  invoiceId: string;
  direction: string;
  invoiceDate: string;
  /** Already formatted to 2dp by Decimal.toFixed(2) */
  subtotal: string;
  kdvTotal: string;
  grandTotal: string;
  fiscalPeriodId: string;
  description: string;
}

/**
 * Generate a double-entry journal posting from an invoice.
 * MUST be called inside db.transaction() — uses `tx` for all queries.
 *
 * Outbound (satış faturası):
 *   Debit  120 (Alıcılar)           → grandTotal
 *   Credit 600 (Yurt İçi Satışlar)  → subtotal
 *   Credit 391 (Hesaplanan KDV)     → kdvTotal
 *
 * Inbound (alış faturası):
 *   Debit  expense acct             → subtotal  (default 770 - Genel Yönetim Giderleri)
 *   Debit  191 (İndirilecek KDV)    → kdvTotal
 *   Credit 320 (Satıcılar)          → grandTotal
 */
async function generateJournalFromInvoice(
  ctx: JournalCtx,
  params: JournalFromInvoiceParams
) {
  // Resolve account codes → IDs using the transaction handle
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

  let journalLines: {
    accountId: string;
    debitAmount: string;
    creditAmount: string;
    description: string;
  }[];

  if (params.direction === "outbound") {
    // Satış faturası
    const [alicilarId, satirId, kdvId] = await Promise.all([
      resolveAccount("120"),  // Alıcılar
      resolveAccount("600"),  // Yurt İçi Satışlar
      resolveAccount("391"),  // Hesaplanan KDV
    ]);

    journalLines = [
      {
        accountId: alicilarId,
        debitAmount: params.grandTotal,
        creditAmount: "0.00",
        description: "Alıcılar — fatura alacağı",
      },
      {
        accountId: satirId,
        debitAmount: "0.00",
        creditAmount: params.subtotal,
        description: "Satış geliri",
      },
      {
        accountId: kdvId,
        debitAmount: "0.00",
        creditAmount: params.kdvTotal,
        description: "Hesaplanan KDV",
      },
    ];
  } else {
    // Alış faturası
    const [giderId, indirilecekKdvId, saticilarId] = await Promise.all([
      resolveAccount("770"),  // Genel Yönetim Giderleri
      resolveAccount("191"),  // İndirilecek KDV
      resolveAccount("320"),  // Satıcılar
    ]);

    journalLines = [
      {
        accountId: giderId,
        debitAmount: params.subtotal,
        creditAmount: "0.00",
        description: "Gider kaydı — fatura",
      },
      {
        accountId: indirilecekKdvId,
        debitAmount: params.kdvTotal,
        creditAmount: "0.00",
        description: "İndirilecek KDV",
      },
      {
        accountId: saticilarId,
        debitAmount: "0.00",
        creditAmount: params.grandTotal,
        description: "Satıcılar — fatura borcu",
      },
    ];
  }

  // Filter out zero-amount lines (e.g. when kdvTotal is 0)
  const nonZeroLines = journalLines.filter(
    (l) => new Decimal(l.debitAmount).gt(0) || new Decimal(l.creditAmount).gt(0)
  );

  if (nonZeroLines.length < 2) return; // Can't create a valid journal entry

  // Create journal entry header — uses tx
  const [entry] = await ctx.tx
    .insert(journalEntries)
    .values({
      companyId: ctx.companyId,
      fiscalPeriodId: params.fiscalPeriodId,
      entryDate: params.invoiceDate,
      description: params.description,
      sourceType: "invoice",
      sourceId: params.invoiceId,
      createdBy: ctx.userId,
    })
    .returning();

  if (!entry) return;

  // Create journal entry lines — uses tx
  const lineInserts = nonZeroLines.map((l) => ({
    journalEntryId: entry.id,
    companyId: ctx.companyId,
    accountId: l.accountId,
    debitAmount: l.debitAmount,
    creditAmount: l.creditAmount,
    description: l.description,
  }));

  await ctx.tx.insert(journalEntryLines).values(lineInserts);
}
