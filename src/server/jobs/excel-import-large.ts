/**
 * excel-import-large — Trigger.dev task for large-file Excel import.
 *
 * Flow:
 *   1. Download from R2 using S3-compatible client
 *   2. Parse with SheetJS (server-side, same logic as browser)
 *   3. Apply column mapping from profile or payload
 *   4. Run Turkish locale parser on each cell
 *   5. Validate with Zod schemas
 *   6. Bulk-insert into import_quarantine
 *   7. Return { total, valid, invalid } counts
 *
 * Triggered when file size > 4MB (routed from UI via tRPC).
 *
 * NOTE: Uses jobEnv + own pg.Pool — does NOT import @/server/db or @/env.ts.
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { parseExcelBuffer } from "@/lib/excel/parse";
import { parseTurkishNumber } from "@/lib/parsers/turkish-number";
import { parseExcelDate } from "@/lib/parsers/excel-date";
import {
  invoiceImportRowSchema,
} from "@/lib/schemas/invoice-import.schema";
import {
  contactImportRowSchema,
} from "@/lib/schemas/contact-import.schema";
import {
  journalImportRowSchema,
} from "@/lib/schemas/journal-import.schema";
import { getJobEnv } from "./_env";
import { Pool } from "pg";

// ── Schema lookup ──────────────────────────────────────────────────

type ImportType = "invoice" | "contact" | "journal";

const SCHEMA_MAP = {
  invoice: invoiceImportRowSchema,
  contact: contactImportRowSchema,
  journal: journalImportRowSchema,
} as const;

// ── Turkish locale parser application ──────────────────────────────

const NUMERIC_FIELDS = new Set([
  "subtotal", "kdvRate", "kdvTotal", "grandTotal",
  "debit", "credit",
]);
const DATE_FIELDS = new Set([
  "invoiceDate", "dueDate", "date",
]);

function applyTurkishParsers(
  row: Record<string, unknown>
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === "") {
      parsed[key] = value;
      continue;
    }

    if (NUMERIC_FIELDS.has(key) && typeof value === "string") {
      try {
        parsed[key] = parseTurkishNumber(value, key).toString();
      } catch {
        parsed[key] = value; // Keep original — Zod will catch it
      }
    } else if (DATE_FIELDS.has(key)) {
      try {
        parsed[key] = parseExcelDate(value, key);
      } catch {
        parsed[key] = value;
      }
    } else {
      parsed[key] = value;
    }
  }

  return parsed;
}

// ── Task definition ────────────────────────────────────────────────

export const excelImportLargeTask = task({
  id: "excel-import-large",
  retry: { maxAttempts: 3, factor: 2 },
  run: async (payload: {
    r2Key: string;
    companyId: string;
    mappingProfileId?: string;
    importType: ImportType;
  }) => {
    logger.info("Starting large file import", { r2Key: payload.r2Key });

    // Initialise S3 + DB lazily inside run() — R2 keys may not exist at worker startup
    const jobEnv = getJobEnv();
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${jobEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: jobEnv.R2_ACCESS_KEY_ID,
        secretAccessKey: jobEnv.R2_SECRET_ACCESS_KEY,
      },
    });
    const R2_BUCKET = jobEnv.R2_BUCKET_NAME;
    const pool = new Pool({ connectionString: jobEnv.SUPABASE_DB_URL, max: 2 });

    try {
      // 1. Download from R2
      const cmd = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: payload.r2Key,
      });
      const response = await s3.send(cmd);
      const body = await response.Body?.transformToByteArray();
      if (!body) {
        throw new Error(`Failed to download file from R2: ${payload.r2Key}`);
      }

      logger.info("Downloaded file", { sizeBytes: body.length });

      // 2. Parse with SheetJS
      const result = parseExcelBuffer(body.buffer as ArrayBuffer, payload.r2Key);
      const sheet = result.sheets[0];
      if (!sheet || sheet.rows.length === 0) {
        logger.warn("No data found in file");
        return { total: 0, valid: 0, invalid: 0 };
      }

      logger.info("Parsed file", {
        rows: sheet.rows.length,
        headers: sheet.headers,
      });

      // 3. Load column mapping
      let mapping: { sourceCol: string; targetField: string }[] = [];

      if (payload.mappingProfileId) {
        const { rows } = await pool.query(
          `SELECT mapping FROM column_mapping_profiles WHERE id = $1 LIMIT 1`,
          [payload.mappingProfileId]
        );
        if ((rows[0] as Record<string, unknown>).mapping) {
          mapping = (rows[0] as Record<string, unknown>).mapping as typeof mapping;
        }
      }

      // If no mapping, use identity mapping (column name = field name)
      if (mapping.length === 0) {
        mapping = sheet.headers.map((h) => ({
          sourceCol: h,
          targetField: h,
        }));
      }

      // 4-5. Apply mapping + Turkish parsers + Zod validation
      const schema = SCHEMA_MAP[payload.importType];
      let validCount = 0;
      let invalidCount = 0;

      // Collect quarantine records for batch insert
      const quarantineRecords: {
        companyId: string;
        source: string;
        rawData: Record<string, unknown>;
        status: string;
        errorMessage: string | null;
        mappingProfileId: string | null;
      }[] = [];

      for (const row of sheet.rows) {
        // Apply column mapping
        const mapped: Record<string, unknown> = {};
        for (const m of mapping) {
          if (m.targetField) {
            mapped[m.targetField] = row[m.sourceCol];
          }
        }

        // Apply Turkish locale parsers
        const parsed = applyTurkishParsers(mapped);

        // Validate with Zod
        const validationResult = schema.safeParse(parsed);
        let errorMessage: string | null = null;

        if (validationResult.success) {
          validCount++;
        } else {
          invalidCount++;
          errorMessage = validationResult.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        }

        quarantineRecords.push({
          companyId: payload.companyId,
          source: "excel-large",
          rawData: parsed,
          status: "pending",
          errorMessage,
          mappingProfileId: payload.mappingProfileId ?? null,
        });
      }

      // 6. Bulk-insert into quarantine (batch of 500)
      const BATCH_SIZE = 500;
      for (let i = 0; i < quarantineRecords.length; i += BATCH_SIZE) {
        const batch = quarantineRecords.slice(i, i + BATCH_SIZE);

        // Build parameterized INSERT for each batch
        const values: unknown[] = [];
        const placeholders: string[] = [];

        batch.forEach((rec, idx) => {
          const offset = idx * 6;
          placeholders.push(
            `($${String(offset + 1)}, $${String(offset + 2)}, $${String(offset + 3)}::jsonb, $${String(offset + 4)}, $${String(offset + 5)}, $${String(offset + 6)})`
          );
          values.push(
            rec.companyId,
            rec.source,
            JSON.stringify(rec.rawData),
            rec.status,
            rec.errorMessage,
            rec.mappingProfileId
          );
        });

        await pool.query(
          `INSERT INTO import_quarantine (company_id, source, raw_data, status, error_message, mapping_profile_id)
           VALUES ${placeholders.join(", ")}`,
          values
        );

        logger.info(`Inserted batch ${String(Math.floor(i / BATCH_SIZE) + 1)}`, {
          count: batch.length,
        });
      }

      // 7. Return counts
      const total = validCount + invalidCount;
      logger.info("Import complete", { total, valid: validCount, invalid: invalidCount });

      return { total, valid: validCount, invalid: invalidCount };
    } finally {
      await pool.end();
    }
  },
});
