/**
 * Import Promotion — moves approved quarantine records into live tables.
 *
 * Three promotion paths:
 *   - Contact:  rawData → contacts table
 *   - Invoice:  rawData → invoices + invoice_line_items + journal entries
 *   - Journal:  rawData → journal_entries + journal_entry_lines
 *
 * Each promoter:
 *   1. Validates rawData against its Zod schema
 *   2. Inserts into the target table(s)
 *   3. Returns the created entity ID
 *
 * On validation failure, throws with a descriptive error message.
 *
 * ATOMICITY:
 *   promoteInvoice wraps everything in db.transaction() so that
 *   invoice + line item + journal entry are created atomically.
 *   If journal creation fails (e.g. missing account code), the
 *   invoice is also rolled back.
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
 * Creates (inside a single DB transaction):
 *   1. The invoice header
 *   2. A single synthetic line item
 *   3. A double-entry journal posting:
 *      - Outbound: DEBIT 120, CREDIT 600, CREDIT 391
 *      - Inbound:  DEBIT 770, DEBIT 191, CREDIT 320
 *
 * If any step fails, the entire transaction is rolled back.
 */
export async function promoteInvoice(
  db: Db,
  companyId: string,
  rawData: Record<string, unknown>,
  userId?: string
): Promise<{ id: string }> {
  const parsed = invoiceImportRowSchema.parse(rawData);

  return db.transaction(async (tx) => {
    // Resolve (or create) the contact by name
    let contactId: string | null = null;
    if (parsed.contactName) {
      const existingContacts = await tx
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
        const [newContact] = await tx
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
    const currentPeriod = await tx
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

    if (!currentPeriod) {
      throw new Error(
        "Açık bir mali dönem bulunamadı. İçe aktarma için bir dönem açılmalıdır."
      );
    }

    // ── Create invoice header ────────────────────────────────────────
    const subtotal = new Decimal(parsed.subtotal);
    const kdvTotal = new Decimal(parsed.kdvTotal);
    const grandTotal = new Decimal(parsed.grandTotal);

    const [invoice] = await tx
      .insert(invoices)
      .values({
        companyId,
        contactId,
        fiscalPeriodId: currentPeriod.id,
        invoiceNumber: parsed.invoiceNumber,
        invoiceDate: parsed.invoiceDate,
        dueDate: parsed.dueDate ?? null,
        direction: parsed.direction,
        currency: parsed.currency,
        subtotal: subtotal.toFixed(2),
        kdvTotal: kdvTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        notes: parsed.notes ?? null,
        status: "draft",
      })
      .returning({ id: invoices.id });

    // ── Create synthetic line item ───────────────────────────────────
    const kdvRate = kdvTotal.isZero()
      ? "0"
      : kdvTotal.div(subtotal).times(100).toDecimalPlaces(0).toString();

    await tx.insert(invoiceLineItems).values({
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

    // ── Create auto-journal entry ────────────────────────────────────
    // Same pattern as generateJournalFromInvoice in invoices.ts
    const resolveAccount = async (code: string): Promise<string> => {
      const acct = await tx
        .select({ id: chartOfAccounts.id })
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.code, code))
        .limit(1)
        .then((rows) => rows[0]);

      if (!acct) {
        throw new Error(
          `Hesap kodu bulunamadı: ${code}. Lütfen hesap planını kontrol edin.`
        );
      }
      return acct.id;
    };

    let journalLines: {
      accountId: string;
      debitAmount: string;
      creditAmount: string;
      description: string;
    }[];

    if (parsed.direction === "outbound") {
      // Satış faturası
      const [alicilarId, satirId, kdvId] = await Promise.all([
        resolveAccount("120"),  // Alıcılar
        resolveAccount("600"),  // Yurt İçi Satışlar
        resolveAccount("391"),  // Hesaplanan KDV
      ]);

      journalLines = [
        {
          accountId: alicilarId,
          debitAmount: grandTotal.toFixed(2),
          creditAmount: "0.00",
          description: "Alıcılar — fatura alacağı",
        },
        {
          accountId: satirId,
          debitAmount: "0.00",
          creditAmount: subtotal.toFixed(2),
          description: "Satış geliri",
        },
        {
          accountId: kdvId,
          debitAmount: "0.00",
          creditAmount: kdvTotal.toFixed(2),
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
          debitAmount: subtotal.toFixed(2),
          creditAmount: "0.00",
          description: "Gider kaydı — fatura",
        },
        {
          accountId: indirilecekKdvId,
          debitAmount: kdvTotal.toFixed(2),
          creditAmount: "0.00",
          description: "İndirilecek KDV",
        },
        {
          accountId: saticilarId,
          debitAmount: "0.00",
          creditAmount: grandTotal.toFixed(2),
          description: "Satıcılar — fatura borcu",
        },
      ];
    }

    // Filter out zero-amount lines (e.g. when kdvTotal is 0)
    const nonZeroLines = journalLines.filter(
      (l) => new Decimal(l.debitAmount).gt(0) || new Decimal(l.creditAmount).gt(0)
    );

    // Need at least 2 lines for a valid double-entry
    if (nonZeroLines.length >= 2) {
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          fiscalPeriodId: currentPeriod.id,
          entryDate: parsed.invoiceDate,
          description: `Fatura: ${parsed.invoiceNumber} — ${parsed.contactName}`,
          sourceType: "import",
          sourceId: invoice!.id,
          createdBy: userId ?? null,
        })
        .returning({ id: journalEntries.id });

      if (entry) {
        const lineInserts = nonZeroLines.map((l) => ({
          journalEntryId: entry.id,
          companyId,
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description,
        }));

        await tx.insert(journalEntryLines).values(lineInserts);
      }
    }

    return invoice!;
  });
}

// ── Journal entry promotion ───────────────────────────────────────

/**
 * Promotes multiple journal import rows as a single journal entry.
 *
 * IMPORTANT: The caller MUST group rows by (entryDate + description)
 * before calling this function. Each call creates exactly one
 * journal_entry with N journal_entry_lines. The DB balance trigger
 * (DEFERRABLE) will reject the transaction if SUM(debit) ≠ SUM(credit).
 *
 * @param rows - Array of quarantine records. All rows must share the
 *               same entryDate and description.
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

  if (!currentPeriod) {
    throw new Error(
      "Açık bir mali dönem bulunamadı. Yevmiye kaydı için bir dönem açılmalıdır."
    );
  }

  // Create the journal entry header
  const [entry] = await db
    .insert(journalEntries)
    .values({
      companyId,
      fiscalPeriodId: currentPeriod.id,
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
