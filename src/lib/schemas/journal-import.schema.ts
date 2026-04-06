/**
 * Journal Entry Import Zod Schema — validates a single row from an Excel journal import.
 *
 * Each row represents a journal entry line (borç or alacak).
 * Lines are grouped by entry date + description during import processing.
 */
import { z } from "zod";
import { parseTurkishNumber, parseExcelDate, ParseError } from "../parsers";

// ── Custom Zod transformers ────────────────────────────────────────

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

// ── Journal Import Row Schema ──────────────────────────────────────

export const journalImportRowSchema = z.object({
  /** Entry date — Turkish date or Excel serial */
  entryDate: excelDate,

  /** TDHP account code — e.g. '102', '120', '320' */
  accountCode: z
    .string()
    .min(1, "Hesap kodu zorunludur")
    .max(20, "Hesap kodu çok uzun")
    .transform((val) => val.trim()),

  /** Debit amount — Turkish number, defaults to '0.00' */
  debitAmount: turkishDecimal.default("0"),

  /** Credit amount — Turkish number, defaults to '0.00' */
  creditAmount: turkishDecimal.default("0"),

  /** Entry description — groups lines into a single journal entry */
  description: z
    .string()
    .min(1, "Açıklama zorunludur")
    .max(500, "Açıklama çok uzun"),

  /** Line-level description — optional */
  lineDescription: z
    .string()
    .max(500)
    .optional()
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must become undefined
    .transform((val) => val?.trim() || undefined),

  /** Source type — defaults to 'import' */
  sourceType: z
    .string()
    .max(30)
    .default("import"),
});

export type JournalImportRow = z.infer<typeof journalImportRowSchema>;

/**
 * Validate a batch of journal import rows.
 */
export function validateJournalImportBatch(
  rows: unknown[]
): { valid: JournalImportRow[]; errors: { row: number; issues: string[] }[] } {
  const valid: JournalImportRow[] = [];
  const errors: { row: number; issues: string[] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = journalImportRowSchema.safeParse(rows[i]);
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
