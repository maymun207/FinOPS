/**
 * gib-fatura-submit — Durable Trigger.dev task for GIB e-Fatura submission.
 *
 * Pipeline:
 *   1. Fetch invoice + line items from Supabase
 *   2. Build UBL 2.1 XML envelope
 *   3. Submit to GIB (or intermediary)
 *   4. Poll for acceptance (PENDING → ACCEPTED/REJECTED)
 *   5. Update invoice.gib_status + gib_ettn in Supabase
 *
 * Retry: exponential backoff — max 10 attempts, factor 2, max 3600s
 * Idempotent: skips if invoice already has gib_status=accepted
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { Pool } from "pg";
import { buildUBLInvoice, generateInvoiceId, type UBLInvoiceData, type UBLLineItem } from "@/lib/gib/ubl-builder";
import { createGIBClient, type GIBStatus } from "@/lib/gib/gib-client";

// ── Task payload ────────────────────────────────────────────────────

interface GIBSubmitPayload {
  invoiceId: string;
  companyId: string;
}

// ── Invoice row types ───────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  company_id: string;
  invoice_number: string;
  invoice_date: string;
  direction: string;
  currency: string;
  subtotal: string;
  kdv_total: string;
  grand_total: string;
  gib_uuid: string | null;
  gib_ettn: string | null;
  gib_status: string | null;
  // Supplier info (from companies)
  company_name: string;
  company_legal_name: string | null;
  company_tax_id: string | null;
  // Customer info (from contacts)
  contact_name: string | null;
  contact_tax_id: string | null;
  contact_address: string | null;
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  subtotal: string;
  kdv_rate: string;
  kdv_amount: string;
  total: string;
}

// ── Main task ───────────────────────────────────────────────────────

export const gibFaturaSubmitTask = task({
  id: "gib-fatura-submit",
  retry: {
    maxAttempts: 10,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 3600_000,
  },
  run: async (payload: GIBSubmitPayload) => {
    const startTime = Date.now();
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not set");

    const pool = new Pool({ connectionString: dbUrl, max: 2 });

    try {
      // ── Step 0: Idempotency check ──
      const existing = await pool.query<{ gib_status: string | null }>(
        `SELECT gib_status FROM invoices WHERE id = $1 AND company_id = $2`,
        [payload.invoiceId, payload.companyId],
      );

      if (existing.rows.length === 0) {
        throw new Error(`Fatura bulunamadı: ${payload.invoiceId}`);
      }

      if (existing.rows[0]!.gib_status === "accepted") {
        logger.info("Invoice already accepted by GIB, skipping", { invoiceId: payload.invoiceId });
        return {
          status: "skipped" as const,
          reason: "already_accepted",
          invoiceId: payload.invoiceId,
          latencyMs: Date.now() - startTime,
        };
      }

      // ── Step 1: Fetch invoice + line items ──
      const invoiceResult = await pool.query<InvoiceRow>(
        `SELECT
           i.id, i.company_id, i.invoice_number, i.invoice_date,
           i.direction, i.currency, i.subtotal, i.kdv_total, i.grand_total,
           i.gib_uuid, i.gib_ettn, i.gib_status,
           c.name AS company_name, c.legal_name AS company_legal_name, c.tax_id AS company_tax_id,
           ct.name AS contact_name, ct.tax_id AS contact_tax_id, ct.address AS contact_address
         FROM invoices i
         JOIN companies c ON c.id = i.company_id
         LEFT JOIN contacts ct ON ct.id = i.contact_id
         WHERE i.id = $1 AND i.company_id = $2`,
        [payload.invoiceId, payload.companyId],
      );

      if (invoiceResult.rows.length === 0) {
        throw new Error(`Invoice not found: ${payload.invoiceId}`);
      }

      const inv = invoiceResult.rows[0]!;

      const lineItemsResult = await pool.query<LineItemRow>(
        `SELECT id, description, quantity, unit_price, subtotal, kdv_rate, kdv_amount, total
         FROM invoice_line_items
         WHERE invoice_id = $1 AND company_id = $2
         ORDER BY created_at`,
        [payload.invoiceId, payload.companyId],
      );

      logger.info("Invoice data fetched", {
        invoiceId: inv.id,
        lineCount: lineItemsResult.rows.length,
      });

      // ── Step 1b: Generate/use GIB UUID ──
      let gibUuid = inv.gib_uuid;
      if (!gibUuid) {
        gibUuid = crypto.randomUUID();
        await pool.query(
          `UPDATE invoices SET gib_uuid = $1, updated_at = NOW() WHERE id = $2`,
          [gibUuid, payload.invoiceId],
        );
        logger.info("Generated GIB UUID", { gibUuid });
      }

      // ── Step 2: Build UBL XML ──
      const lineItems: UBLLineItem[] = lineItemsResult.rows.map((li, idx) => ({
        id: idx + 1,
        description: li.description,
        quantity: parseFloat(li.quantity),
        unitPrice: parseFloat(li.unit_price),
        lineTotal: parseFloat(li.subtotal),
        kdvRate: parseFloat(li.kdv_rate),
        kdvAmount: parseFloat(li.kdv_amount),
      }));

      const ublData: UBLInvoiceData = {
        uuid: gibUuid,
        invoiceId: generateInvoiceId("TST", new Date(inv.invoice_date).getFullYear()),
        issueDate: inv.invoice_date,
        invoiceTypeCode: inv.direction === "outbound" ? "SATIS" : "IADE",
        profileId: "TEMELFATURA",
        currency: inv.currency,
        supplier: {
          name: inv.company_legal_name ?? inv.company_name,
          taxId: inv.company_tax_id ?? "0000000000",
        },
        customer: {
          name: inv.contact_name ?? "Bilinmeyen Müşteri",
          taxId: inv.contact_tax_id ?? undefined,
          address: inv.contact_address ?? undefined,
        },
        lineItems,
        taxTotal: parseFloat(inv.kdv_total),
        lineExtensionAmount: parseFloat(inv.subtotal),
        taxInclusiveAmount: parseFloat(inv.grand_total),
      };

      const xml = buildUBLInvoice(ublData);
      logger.info("UBL XML built", { xmlLength: xml.length });

      // ── Step 3: Update status to pending ──
      await pool.query(
        `UPDATE invoices SET gib_status = 'pending', updated_at = NOW() WHERE id = $1`,
        [payload.invoiceId],
      );

      // ── Step 4: Submit to GIB (or intermediary) ──
      const client = createGIBClient();
      const submitResult = await client.submitInvoice(xml);

      if (!submitResult.success) {
        await pool.query(
          `UPDATE invoices SET gib_status = 'rejected', updated_at = NOW() WHERE id = $1`,
          [payload.invoiceId],
        );
        throw new Error(`GIB submission failed: ${submitResult.errorMessage}`);
      }

      logger.info("Submitted to GIB", { ettn: submitResult.ettn, status: submitResult.status });

      // ── Step 5: Poll for acceptance ──
      let finalStatus: GIBStatus = submitResult.status;
      let pollAttempts = 0;
      const maxPolls = 5;

      while (finalStatus === "PENDING" && pollAttempts < maxPolls) {
        pollAttempts++;
        await new Promise((r) => setTimeout(r, 2000));
        const statusResult = await client.checkStatus(submitResult.ettn);
        finalStatus = statusResult.status;
        logger.info("Poll status", { attempt: pollAttempts, status: finalStatus });
      }

      // ── Step 6: Update invoice status ──
      const gibStatus = finalStatus === "ACCEPTED" ? "accepted" : finalStatus === "REJECTED" ? "rejected" : "pending";
      await pool.query(
        `UPDATE invoices
         SET gib_status = $1, gib_ettn = $2, updated_at = NOW()
         WHERE id = $3`,
        [gibStatus, submitResult.ettn, payload.invoiceId],
      );

      logger.info("GIB submission complete", {
        invoiceId: payload.invoiceId,
        gibStatus,
        ettn: submitResult.ettn,
        latencyMs: Date.now() - startTime,
      });

      return {
        status: gibStatus as "accepted" | "rejected" | "pending",
        invoiceId: payload.invoiceId,
        ettn: submitResult.ettn,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      await pool.end();
    }
  },
});
