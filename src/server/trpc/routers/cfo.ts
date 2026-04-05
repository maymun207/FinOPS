/**
 * CFO tRPC Router — Virtual CFO (AI-powered financial assistant).
 *
 * Endpoints:
 *   cfo.ask          — Natural-language question → SQL → results
 *   cfo.approve      — Approve a generated Q&A pair for training
 *   cfo.history      — Recent AI query log for this company
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";

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
        status: "triggered",
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
        status: "training_triggered",
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
        queries: result.rows as Array<{
          id: number;
          query_text: string;
          response_text: string;
          model: string;
          tokens_used: number | null;
          latency_ms: number | null;
          created_at: string;
        }>,
      };
    }),
});
