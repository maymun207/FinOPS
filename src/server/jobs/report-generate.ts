/**
 * report-generate — Report generation task (placeholder — Step 18).
 *
 * Purpose:
 *   Generates financial reports (balance sheet, income statement,
 *   trial balance) as PDF/Excel. Called on-demand from the dashboard.
 *
 * Placeholder: Returns mock report metadata.
 */
import { task, logger } from "@trigger.dev/sdk/v3";

export type ReportType = "balance_sheet" | "income_statement" | "trial_balance";

export const reportGenerateTask = task({
  id: "report-generate",
  retry: { maxAttempts: 2, factor: 2 },
  run: async (payload: {
    companyId: string;
    reportType: ReportType;
    fiscalPeriodId: string;
    format: "pdf" | "xlsx";
  }) => {
    logger.info("Starting report generation (placeholder)", {
      reportType: payload.reportType,
      format: payload.format,
      companyId: payload.companyId,
    });

    // Step 18 will implement:
    // 1. Query aggregated financial data for the period
    // 2. Apply TDHP account structure
    // 3. Generate report using template
    // 4. Upload to R2
    // 5. Return download URL

    const mockResult = {
      reportType: payload.reportType,
      format: payload.format,
      fiscalPeriodId: payload.fiscalPeriodId,
      status: "placeholder" as const,
      downloadUrl: null as string | null,
      generatedAt: new Date().toISOString(),
    };

    logger.info("Report generation complete (placeholder)", mockResult);
    return mockResult;
  },
});
