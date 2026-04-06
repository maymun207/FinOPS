/**
 * Exports tRPC Router — Excel data export endpoints.
 *
 * Returns base64-encoded .xlsx buffers for client-side download.
 *
 * Endpoints:
 *   export.transactions — Journal entry lines as Excel
 *   export.contacts     — Contact list as Excel
 *   export.invoices     — Invoice list as Excel
 */
import "server-only";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { journalEntryLines } from "../../db/schema/journal-entry-lines";
import { journalEntries } from "../../db/schema/journal-entries";
import { chartOfAccounts } from "../../db/schema/chart-of-accounts";
import { contacts } from "../../db/schema/contacts";
import { invoices } from "../../db/schema/invoices";
import { eq } from "drizzle-orm";
import {
  exportTransactions,
  exportContacts,
  exportInvoices,
} from "@/lib/excel/export-data";

export const exportsRouter = createTRPCRouter({
  /**
   * Export journal entry lines as Excel.
   * Returns base64-encoded xlsx buffer.
   */
  transactions: companyProcedure.mutation(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        date: journalEntries.entryDate,
        account_code: chartOfAccounts.code,
        account_name: chartOfAccounts.name,
        description: journalEntryLines.description,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
      })
      .from(journalEntryLines)
      .innerJoin(
        journalEntries,
        eq(journalEntryLines.journalEntryId, journalEntries.id)
      )
      .innerJoin(
        chartOfAccounts,
        eq(journalEntryLines.accountId, chartOfAccounts.id)
      )
      .where(eq(journalEntryLines.companyId, ctx.companyId))
      .orderBy(journalEntries.entryDate);

    const mapped = rows.map((r) => ({
      date: r.date,
      account_code: r.account_code,
      account_name: r.account_name,
      description: r.description ?? "",
      debit: Number(r.debit),
      credit: Number(r.credit),
    }));

    const buffer = await exportTransactions(mapped);

    return {
      base64: buffer.toString("base64"),
      filename: `hareketler_${new Date().toISOString().split("T")[0] ?? "export"}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }),

  /**
   * Export contacts as Excel.
   */
  contacts: companyProcedure.mutation(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        name: contacts.name,
        type: contacts.type,
        tax_id: contacts.taxId,
        email: contacts.email,
        phone: contacts.phone,
        address: contacts.address,
      })
      .from(contacts)
      .where(eq(contacts.companyId, ctx.companyId))
      .orderBy(contacts.name);

    const buffer = await exportContacts(rows);

    return {
      base64: buffer.toString("base64"),
      filename: `cariler_${new Date().toISOString().split("T")[0] ?? "export"}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }),

  /**
   * Export invoices as Excel.
   */
  invoices: companyProcedure.mutation(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        invoice_number: invoices.invoiceNumber,
        invoice_date: invoices.invoiceDate,
        due_date: invoices.dueDate,
        direction: invoices.direction,
        contact_name: contacts.name,
        status: invoices.status,
        subtotal: invoices.subtotal,
        kdv_total: invoices.kdvTotal,
        grand_total: invoices.grandTotal,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(invoices.companyId, ctx.companyId))
      .orderBy(invoices.invoiceDate);

    const mapped = rows.map((r) => ({
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      direction: r.direction,
      contact_name: r.contact_name,
      status: r.status,
      subtotal: Number(r.subtotal),
      kdv_total: Number(r.kdv_total),
      grand_total: Number(r.grand_total),
    }));

    const buffer = await exportInvoices(mapped);

    return {
      base64: buffer.toString("base64"),
      filename: `faturalar_${new Date().toISOString().split("T")[0] ?? "export"}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }),
});
