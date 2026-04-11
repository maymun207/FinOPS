/**
 * Import Promotion — moves approved quarantine records into live tables.
 *
 * Three promotion paths:
 *   - Contact:  rawData → contacts table
 *   - Invoice:  rawData → invoices + invoice_line_items (no auto-journal for imports)
 *   - Journal:  rawData → journal_entries + journal_entry_lines
 *
 * Each promoter:
 *   1. Validates rawData against its Zod schema
 *   2. Inserts into the target table(s)
 *   3. Returns the created entity ID
 *
 * On validation failure, throws with a descriptive error message.
 */
import "server-only";
import { eq, and, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  contacts,
  invoices,
  invoiceLineItems,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  fiscalPeriods,
} from "@/server/db/schema";
import { contactImportRowSchema } from "@/lib/schemas/contact-import.schema";
import { invoiceImportRowSchema } from "@/lib/schemas/invoice-import.schema";
import { journalImportRowSchema } from "@/lib/schemas/journal-import.schema";
import type { db as DbClient } from "@/server/db/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

type Db = typeof DbClient;

// ── Contact promotion ─────────────────────────────────────────────

export async function promoteContact(
  db: Db,
  companyId: string,
  rawData: Record<string, unknown>
): Promise<{ id: string }> {
  const parsed = contactImportRowSchema.parse(rawData);

  const [contact] = await db
    .insert(contacts)
    .values({
      companyId,
      name: parsed.name,
      type: parsed.type,
      taxId: parsed.taxId ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      address: parsed.address ?? null,
    })
    .returning({ id: contacts.id });

  return contact!;
}

// ── Invoice promotion ─────────────────────────────────────────────

/**
 * Promotes an invoice quarantine record.
 *
 * The imported row represents a single invoice with header-level totals
 * (subtotal, kdvTotal, grandTotal). We create:
 *   1. The invoice header
 *   2. A single synthetic line item
 *
 * No auto-journal generation for imports — users can trigger that separately.
 * This avoids cascading errors from missing chart-of-accounts entries.
 */
export async function promoteInvoice(
  db: Db,
  companyId: string,
  rawData: Record<string, unknown>
): Promise<{ id: string }> {
  const parsed = invoiceImportRowSchema.parse(rawData);

  // Resolve (or create) the contact by name
  let contactId: string | null = null;
  if (parsed.contactName) {
    const existingContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.companyId, companyId),
          eq(contacts.name, parsed.contactName)
        )
      )
      .limit(1);

    if (existingContacts[0]) {
      contactId = existingContacts[0].id;
    } else {
      // Auto-create contact
      const [newContact] = await db
        .insert(contacts)
        .values({
          companyId,
          name: parsed.contactName,
          type: parsed.direction === "outbound" ? "customer" : "vendor",
          taxId: parsed.contactTaxId ?? null,
        })
        .returning({ id: contacts.id });
      contactId = newContact!.id;
    }
  }

  // Find open fiscal period
  const currentPeriod = await db
    .select({ id: fiscalPeriods.id })
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.companyId, companyId),
        eq(fiscalPeriods.isClosed, false)
      )
    )
    .orderBy(desc(fiscalPeriods.startDate))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  // Create invoice header
  const subtotal = new Decimal(parsed.subtotal);
  const kdvTotal = new Decimal(parsed.kdvTotal);
  const grandTotal = new Decimal(parsed.grandTotal);

  const [invoice] = await db
    .insert(invoices)
    .values({
      companyId,
      contactId,
      fiscalPeriodId: currentPeriod?.id ?? null,
      invoiceNumber: parsed.invoiceNumber,
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate ?? null,
      direction: parsed.direction,
      currency: parsed.currency ?? "TRY",
      subtotal: subtotal.toFixed(2),
      kdvTotal: kdvTotal.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      notes: parsed.notes ?? null,
      status: "draft",
    })
    .returning({ id: invoices.id });

  // Create a single synthetic line item representing the whole invoice
  const kdvRate = kdvTotal.isZero()
    ? "0"
    : kdvTotal.div(subtotal).times(100).toDecimalPlaces(0).toString();

  await db.insert(invoiceLineItems).values({
    invoiceId: invoice!.id,
    companyId,
    description: parsed.notes ?? `İçe aktarılan fatura: ${parsed.invoiceNumber}`,
    quantity: "1",
    unitPrice: subtotal.toFixed(2),
    kdvRate,
    subtotal: subtotal.toFixed(2),
    kdvAmount: kdvTotal.toFixed(2),
    total: grandTotal.toFixed(2),
  });

  return invoice!;
}

// ── Journal entry promotion ───────────────────────────────────────

/**
 * Promotes a single journal line from quarantine.
 * 
 * Journal entries are promoted individually — each quarantine row becomes
 * a standalone journal entry with two lines (debit + credit).
 * The user provides debitAmount and creditAmount, plus an accountCode.
 * 
 * For the balancing side, we use a catch-all "suspicious" account (999)
 * or create a simple 2-line entry if both amounts are provided from
 * the same row.
 * 
 * NOTE: The journal import schema stores one side per row. In practice,
 * rows should be grouped by date+description BEFORE calling this.
 * For now, we handle single-row promotion gracefully.
 */
export async function promoteJournalEntry(
  db: Db,
  companyId: string,
  userId: string,
  rows: { rawData: Record<string, unknown> }[]
): Promise<{ id: string }> {
  // Parse and validate all rows
  const parsed = rows.map((r) => journalImportRowSchema.parse(r.rawData));

  if (parsed.length === 0) {
    throw new Error("No rows to promote");
  }

  // Use first row's date and description as the entry header
  const header = parsed[0]!;

  // Find open fiscal period
  const currentPeriod = await db
    .select({ id: fiscalPeriods.id })
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.companyId, companyId),
        eq(fiscalPeriods.isClosed, false)
      )
    )
    .orderBy(desc(fiscalPeriods.startDate))
    .limit(1)
    .then((r) => r[0] ?? null);

  // Create the journal entry header
  const [entry] = await db
    .insert(journalEntries)
    .values({
      companyId,
      fiscalPeriodId: currentPeriod?.id ?? null,
      entryDate: header.entryDate,
      description: header.description,
      sourceType: "import",
      createdBy: userId,
    })
    .returning({ id: journalEntries.id });

  // Create journal entry lines — resolve account codes to IDs
  for (const line of parsed) {
    // Look up account by code
    const account = await db
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.code, line.accountCode))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!account) {
      throw new Error(
        `Hesap kodu bulunamadı: ${line.accountCode}. Lütfen hesap planını kontrol edin.`
      );
    }

    await db.insert(journalEntryLines).values({
      journalEntryId: entry!.id,
      companyId,
      accountId: account.id,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.lineDescription ?? line.description,
    });
  }

  return entry!;
}
