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
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";
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
import { db } from "@/server/db";
import { importQuarantine } from "@/server/db/schema/import-quarantine";
import { columnMappingProfiles } from "@/server/db/schema/column-mapping-profiles";
import { eq } from "drizzle-orm";

// ── S3 client for Cloudflare R2 ────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT ?? "",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const R2_BUCKET = process.env.R2_BUCKET ?? "finops-imports";

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
    let mapping: Array<{ sourceCol: string; targetField: string }> = [];

    if (payload.mappingProfileId) {
      const [profile] = await db
        .select()
        .from(columnMappingProfiles)
        .where(eq(columnMappingProfiles.id, payload.mappingProfileId))
        .limit(1);

      if (profile?.mapping) {
        mapping = profile.mapping as typeof mapping;
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
    const quarantineRecords: Array<{
      companyId: string;
      source: string;
      rawData: Record<string, unknown>;
      status: string;
      errorMessage: string | null;
      mappingProfileId: string | null;
    }> = [];

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
      const result = schema.safeParse(parsed);
      let errorMessage: string | null = null;

      if (result.success) {
        validCount++;
      } else {
        invalidCount++;
        errorMessage = result.error.issues
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
      await db.insert(importQuarantine).values(batch);
      logger.info(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
        count: batch.length,
      });
    }

    // 7. Return counts
    const total = validCount + invalidCount;
    logger.info("Import complete", { total, valid: validCount, invalid: invalidCount });

    return { total, valid: validCount, invalid: invalidCount };
  },
});
