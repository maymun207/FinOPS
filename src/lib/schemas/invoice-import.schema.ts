/**
 * Invoice Import Zod Schema — validates a single row from an Excel invoice import.
 *
 * Handles Turkish locale values by running them through parsers before validation.
 * This schema is used at the row level — each row from the spreadsheet is
 * validated independently.
 */
import { z } from "zod";
import { parseTurkishNumber, parseExcelDate, ParseError } from "../parsers";
import _Decimal from "decimal.js";

// ── Custom Zod transformers ────────────────────────────────────────

/** Parse a Turkish number string into a Decimal-compatible string */
const turkishDecimal = z
  .unknown()
  .transform((val, ctx) => {
    try {
      return parseTurkishNumber(val).toFixed(2);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: e instanceof ParseError ? e.message : "Geçersiz sayı",
      });
      return z.NEVER;
    }
  });

/** Parse an Excel date (serial or string) into ISO format */
const excelDate = z
  .unknown()
  .transform((val, ctx) => {
    try {
      return parseExcelDate(val);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: e instanceof ParseError ? e.message : "Geçersiz tarih",
      });
      return z.NEVER;
    }
  });

// ── Invoice Import Row Schema ──────────────────────────────────────

export const invoiceImportRowSchema = z.object({
  /** Invoice number — required, non-empty string */
  invoiceNumber: z
    .string()
    .min(1, "Fatura numarası zorunludur")
    .max(50, "Fatura numarası çok uzun"),

  /** Invoice date — Turkish date or Excel serial */
  invoiceDate: excelDate,

  /** Due date — optional */
  dueDate: excelDate.optional(),

  /** Direction: 'inbound' (alış) or 'outbound' (satış) */
  direction: z
    .string()
    .transform((val) => {
      const lower = val.trim().toLowerCase();
      // Accept Turkish and English variants
      if (["outbound", "satış", "satis", "satış faturası", "sales"].includes(lower)) {
        return "outbound";
      }
      if (["inbound", "alış", "alis", "alış faturası", "purchase"].includes(lower)) {
        return "inbound";
      }
      return val;
    })
    .pipe(z.enum(["inbound", "outbound"], {
      error: "Fatura yönü 'inbound' veya 'outbound' olmalıdır",
    })),

  /** Contact name — will be matched/created by the import pipeline */
  contactName: z
    .string()
    .min(1, "Cari ismi zorunludur")
    .max(255),

  /** Contact tax ID (VKN) — optional, used for matching */
  contactTaxId: z.string().max(50).optional(),

  /** Subtotal — Turkish number */
  subtotal: turkishDecimal,

  /** KDV total — Turkish number */
  kdvTotal: turkishDecimal,

  /** Grand total — Turkish number */
  grandTotal: turkishDecimal,

  /** Currency — defaults to TRY */
  currency: z
    .string()
    .max(3)
    .transform((val) => val.trim().toUpperCase())
    .default("TRY"),

  /** Notes — optional */
  notes: z.string().optional(),
});

export type InvoiceImportRow = z.infer<typeof invoiceImportRowSchema>;

/**
 * Validate a batch of invoice import rows.
 */
export function validateInvoiceImportBatch(
  rows: unknown[]
): { valid: InvoiceImportRow[]; errors: { row: number; issues: string[] }[] } {
  const valid: InvoiceImportRow[] = [];
  const errors: { row: number; issues: string[] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = invoiceImportRowSchema.safeParse(rows[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: i + 1,
        issues: result.error.issues.map(
          (iss) => `${iss.path.join(".")}: ${iss.message}`
        ),
      });
    }
  }

  return { valid, errors };
}
