/**
 * Jobs tRPC Router — job status polling + trigger endpoints.
 *
 * Endpoints:
 *   jobs.triggerLargeImport  — trigger large-file Excel import task
 *   jobs.triggerReport       — trigger report generation task
 *   jobs.getStatus           — poll job status by run ID
 *   jobs.listRecent          — list recent job runs for this company
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { ReportType } from "../../jobs/report-generate";

export const jobsRouter = createTRPCRouter({
  /**
   * Trigger a large-file Excel import job.
   * Called when file size > 4MB, after upload to R2.
   */
  triggerLargeImport: companyProcedure
    .input(
      z.object({
        r2Key: z.string().min(1),
        importType: z.enum(["invoice", "contact", "journal"]),
        mappingProfileId: z.uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const handle = await tasks.trigger("excel-import-large", {
        r2Key: input.r2Key,
        companyId: ctx.companyId,
        importType: input.importType,
        mappingProfileId: input.mappingProfileId,
      });

      return {
        runId: handle.id,
        status: "triggered",
      };
    }),

  /**
   * Trigger a report generation job.
   */
  triggerReport: companyProcedure
    .input(
      z.object({
        reportType: z.enum(["trial_balance", "balance_sheet", "income_statement", "kdv_summary"]),
        fiscalPeriodId: z.uuid(),
        format: z.enum(["pdf", "xlsx"]).default("pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const handle = await tasks.trigger("report-generate", {
        companyId: ctx.companyId,
        reportType: input.reportType as ReportType,
        fiscalPeriodId: input.fiscalPeriodId,
        format: input.format,
      });

      return {
        runId: handle.id,
        status: "triggered",
      };
    }),

  /**
   * Poll job status by run ID.
   * Returns the current status and output (if completed).
   */
  getStatus: companyProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const run = await runs.retrieve(input.runId);
        return {
          id: run.id,
          status: run.status,
          output: run.output ?? null, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          finishedAt: run.finishedAt ?? null,
        };
      } catch {
        return {
          id: input.runId,
          status: "NOT_FOUND" as const,
          output: null,
          createdAt: null,
          updatedAt: null,
          finishedAt: null,
        };
      }
    }),

  /**
   * List recent job runs.
   * Uses the Trigger.dev runs API with filtering.
   */
  listRecent: companyProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        taskId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await runs.list({
          limit: input.limit,
          ...(input.taskId ? { taskIdentifier: [input.taskId] } : {}),
        });

        return {
          runs: result.data.map((run) => ({
            id: run.id,
            taskIdentifier: run.taskIdentifier,
            status: run.status,
            createdAt: run.createdAt,
            finishedAt: run.finishedAt ?? null,
          })),
        };
      } catch {
        return { runs: [] };
      }
    }),
});
