/**
 * CFO tRPC Router — Virtual CFO (AI-powered financial assistant).
 *
 * Endpoints:
 *   cfo.ask            — Natural-language question → trigger Vanna inference
 *   cfo.getRunResult   — Poll Trigger.dev run status + retrieve output
 *   cfo.approve        — Approve a generated Q&A pair for training
 *   cfo.history        — Recent AI query log for this company
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { tasks, runs } from "@trigger.dev/sdk/v3";

export const cfoRouter = createTRPCRouter({
  /**
   * Ask the Virtual CFO a question.
   * Triggers the vanna-inference Trigger.dev task and returns the run ID
   * for polling.
   */
  ask: companyProcedure
    .input(
      z.object({
        question: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const handle = await tasks.trigger("vanna-inference", {
        question: input.question,
        companyId: ctx.companyId,
        userId: ctx.userId,
      });

      return {
        runId: handle.id,
        status: "triggered" as const,
      };
    }),

  /**
   * Poll the Trigger.dev run status and retrieve the output when complete.
   * Used by the frontend to check if inference is done.
   */
  getRunResult: companyProcedure
    .input(
      z.object({
        runId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const run = await runs.retrieve(input.runId);

      if (run.status === "COMPLETED") {
        // The run output has the shape from vanna-inference task
        const output = run.output as {
          status: "success" | "rejected";
          question: string;
          sql: string;
          explanation?: string;
          rows: Record<string, unknown>[];
          rowCount?: number;
          reason?: string;
          similarityScore?: number;
          latencyMs: number;
        } | undefined;

        return {
          status: "completed" as const,
          output: output ?? null,
        };
      }

      if (run.status === "FAILED" || run.status === "CANCELED" || run.status === "CRASHED" || run.status === "SYSTEM_FAILURE" || run.status === "EXPIRED" || run.status === "TIMED_OUT") {
        return {
          status: "failed" as const,
          error: run.error?.message ?? "Bilinmeyen hata oluştu",
          output: null,
        };
      }

      // Still running (QUEUED, EXECUTING, REATTEMPTING, FROZEN, etc.)
      return {
        status: "running" as const,
        output: null,
      };
    }),

  /**
   * Approve a generated Q&A pair, adding it to the training corpus.
   * This improves future inference accuracy for the company.
   */
  approve: companyProcedure
    .input(
      z.object({
        question: z.string().min(3),
        sql: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const handle = await tasks.trigger("vanna-training-update", {
        companyId: ctx.companyId,
        question: input.question,
        sql: input.sql,
        wasUserApproved: true,
      });

      return {
        runId: handle.id,
        status: "training_triggered" as const,
      };
    }),

  /**
   * Recent AI query history for this company.
   * Returns the last N queries with their SQL, latency, and timestamps.
   */
  history: companyProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;

      const result = await db.execute(
        sql`SELECT
              id,
              query_text,
              response_text,
              model,
              tokens_used,
              latency_ms,
              created_at
            FROM ai_query_log
            WHERE company_id = ${ctx.companyId}
            ORDER BY created_at DESC
            LIMIT ${limit}`,
      );

      return {
        queries: result.rows as {
          id: number;
          query_text: string;
          response_text: string;
          model: string;
          tokens_used: number | null;
          latency_ms: number | null;
          created_at: string;
        }[],
      };
    }),
});
