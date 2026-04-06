/**
 * Contact Import Zod Schema — validates a single row from an Excel contact import.
 *
 * Maps Turkish column headers to the contacts table structure.
 */
import { z } from "zod";

export const contactImportRowSchema = z.object({
  /** Contact name — required */
  name: z
    .string()
    .min(1, "Cari ismi zorunludur")
    .max(255, "Cari ismi çok uzun"),

  /** Contact type: customer | vendor | both */
  type: z
    .string()
    .transform((val) => {
      const lower = val.trim().toLowerCase();
      if (["customer", "müşteri", "musteri"].includes(lower)) return "customer";
      if (["vendor", "tedarikçi", "tedarikci", "satıcı", "satici"].includes(lower)) return "vendor";
      if (["both", "her ikisi", "müşteri/tedarikçi"].includes(lower)) return "both";
      return val;
    })
    .pipe(
      z.enum(["customer", "vendor", "both"], {
        error: "Cari türü 'customer', 'vendor' veya 'both' olmalıdır",
      })
    ),

  /** VKN — optional, must be exactly 10 digits (tüzel kişi) or 11 digits (TC kimlik) */
  taxId: z
    .string()
    .optional()
    .transform((val) => val?.trim() ?? undefined)
    .pipe(
      z
        .string()
        .regex(/^\d{10,11}$/, "VKN must be 10 digits")
        .optional()
    ),

  /** Email — optional, must be valid if provided */
  email: z
    .email("Geçersiz e-posta adresi")
    .max(255)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val)),

  /** Phone — optional */
  phone: z
    .string()
    .max(50, "Telefon numarası çok uzun")
    .optional()
    .transform((val) => val?.trim() ?? undefined),

  /** Address — optional free text */
  address: z
    .string()
    .optional()
    .transform((val) => val?.trim() ?? undefined),
});

export type ContactImportRow = z.infer<typeof contactImportRowSchema>;

/**
 * Validate a batch of contact import rows.
 */
export function validateContactImportBatch(
  rows: unknown[]
): { valid: ContactImportRow[]; errors: { row: number; issues: string[] }[] } {
  const valid: ContactImportRow[] = [];
  const errors: { row: number; issues: string[] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = contactImportRowSchema.safeParse(rows[i]);
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
