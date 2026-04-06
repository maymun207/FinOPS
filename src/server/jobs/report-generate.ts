/**
 * report-generate — Trigger.dev task for generating financial reports.
 *
 * Supports two output formats:
 *   - xlsx: ExcelJS template-based export (Step 15)
 *   - pdf:  Playwright headless PDF capture of RSC render target (Step 16)
 *
 * Flow:
 *   1. Accept { reportType, companyId, periodId, format }
 *   2. Generate report buffer (Excel or PDF)
 *   3. Upload to R2
 *   4. Return presigned download URL (15-min TTL)
 *
 * NOTE: Uses jobEnv + own pg.Pool — does NOT import @/server/db or @/env.ts.
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  exportMizanReport,
  exportBilancoReport,
  exportGelirTablosuReport,
  exportKdvBeyanReport,
  type MizanRow,
  type BilancoRow,
  type GelirTablosuRow,
  type KdvBeyanRow,
} from "@/lib/excel/export-templates";
import { generatePDF } from "@/lib/pdf/playwright-pdf";
import { jobEnv } from "./_env";
import { Pool } from "pg";

export type ReportType =
  | "trial_balance"
  | "balance_sheet"
  | "income_statement"
  | "kdv_summary";

// ── S3 client for Cloudflare R2 ────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${jobEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: jobEnv.R2_ACCESS_KEY_ID,
    secretAccessKey: jobEnv.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET = jobEnv.R2_BUCKET_NAME;
const PRESIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes

// ── Report type → PDF route mapping ────────────────────────────────

const PDF_ROUTES: Record<ReportType, string> = {
  trial_balance: "mizan",
  balance_sheet: "bilanco",
  income_statement: "gelir-tablosu",
  kdv_summary: "kdv-beyanname",
};

// ── Excel generation ───────────────────────────────────────────────

async function generateExcelBuffer(
  reportType: ReportType,
  data: unknown,
  companyName?: string
): Promise<Buffer> {
  switch (reportType) {
    case "trial_balance":
      return exportMizanReport(data as MizanRow[], companyName);
    case "balance_sheet":
      return exportBilancoReport(data as BilancoRow[], companyName);
    case "income_statement":
      return exportGelirTablosuReport(data as GelirTablosuRow[], companyName);
    case "kdv_summary":
      return exportKdvBeyanReport(data as KdvBeyanRow[], companyName);
    default:
      throw new Error(`Unknown report type: ${String(reportType)}`);
  }
}

// ── Task definition ────────────────────────────────────────────────

export const reportGenerateTask = task({
  id: "report-generate",
  retry: { maxAttempts: 2, factor: 2 },
  run: async (payload: {
    companyId: string;
    reportType: ReportType;
    periodId: string;
    format: "pdf" | "xlsx";
  }) => {
    logger.info("Starting report generation", {
      reportType: payload.reportType,
      format: payload.format,
      companyId: payload.companyId,
    });

    const pool = new Pool({ connectionString: jobEnv.SUPABASE_DB_URL, max: 2 });

    try {
      let buffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      if (payload.format === "pdf") {
        // ── PDF path: Playwright → RSC render target ──────────────
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const route = PDF_ROUTES[payload.reportType];
        const url = `${baseUrl}/reports/${route}/pdf/${payload.periodId}`;

        logger.info("Generating PDF from RSC target", { url });

        buffer = await generatePDF({
          url,
          clerkJwt: process.env.CLERK_SERVICE_JWT,
          cookieDomain: new URL(baseUrl).hostname,
        });

        contentType = "application/pdf";
        fileExtension = "pdf";
      } else {
        // ── Excel path: cached DuckDB data → ExcelJS ──────────────
        const { rows: cacheRows } = await pool.query(
          `SELECT data FROM cached_report_results
           WHERE company_id = $1 AND report_type = $2
           LIMIT 1`,
          [payload.companyId, payload.reportType]
        );

        if (cacheRows.length === 0 || !(cacheRows[0] as Record<string, unknown> | undefined)?.data) {
          logger.warn("No cached data — run DuckDB sync first");
          return {
            reportType: payload.reportType,
            format: payload.format,
            status: "no_data" as const,
            downloadUrl: null,
            generatedAt: new Date().toISOString(),
          };
        }

        const { rows: companyRows } = await pool.query(
          `SELECT name FROM companies WHERE id = $1 LIMIT 1`,
          [payload.companyId]
        );
        const companyName = (companyRows[0] as { name: string } | undefined)?.name;

        buffer = await generateExcelBuffer(
          payload.reportType,
          (cacheRows[0] as Record<string, unknown> | undefined)?.data,
          companyName ?? undefined
        );

        contentType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileExtension = "xlsx";
      }

      logger.info("Report generated", {
        sizeBytes: buffer.length,
        format: payload.format,
      });

      // ── Upload to R2 ──────────────────────────────────────────────
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const r2Key = `reports/${payload.companyId}/${payload.reportType}/${timestamp}.${fileExtension}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      logger.info("Uploaded to R2", { r2Key });

      // ── Presigned URL (15 min) ──────────────────────────────────
      const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }),
        { expiresIn: PRESIGNED_URL_TTL_SECONDS }
      );

      return {
        reportType: payload.reportType,
        format: payload.format,
        status: "completed" as const,
        downloadUrl,
        r2Key,
        sizeBytes: buffer.length,
        expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
        generatedAt: new Date().toISOString(),
      };
    } finally {
      await pool.end();
    }
  },
});
