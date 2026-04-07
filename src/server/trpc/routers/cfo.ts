/**
 * CFO tRPC Router — Virtual CFO (AI-powered financial assistant).
 *
 * Runs Gemini inference INLINE (no Trigger.dev dependency).
 * The ask mutation is async and returns the full result immediately.
 *
 * Endpoints:
 *   cfo.ask      — NL question → Gemini SQL → validate → execute → return rows
 *   cfo.approve  — Save approved Q&A pair for future training
 *   cfo.history  — Recent AI query log for this company
 */
import "server-only";
import { z } from "zod";
import { createTRPCRouter, companyProcedure } from "../trpc";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { SYSTEM_PROMPT } from "@/lib/vanna/schema-context";
import {
  validateSQL,
  extractTableNames,
  extractCTENames,
} from "@/server/jobs/vanna-inference";

// ── Gemini API types ─────────────────────────────────────────────────────────

interface GeminiGenerateResponse {
  candidates: { content: { parts: { text: string }[] } }[];
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

async function generateSQL(question: string, apiKey: string): Promise<string> {
  const prompt = `Aşağıdaki finansal soruyu PostgreSQL sorgusuna çevir. company_id için $1 parametresini kullan.

Soru: ${question}
SQL:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini hata: ${String(response.status)} ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const rawText = data.candidates[0]?.content.parts[0]?.text ?? "";
  const codeBlockMatch = /```(?:sql)?\s*([\s\S]*?)```/.exec(rawText);
  return (codeBlockMatch?.[1] ?? rawText).trim();
}

async function explainSQL(question: string, generatedSql: string, apiKey: string): Promise<string> {
  const prompt = `Kullanıcının sorusu: "${question}"\n\nÜretilen SQL:\n${generatedSql}\n\nBu SQL sorgusunun ne yaptığını bir cümle ile Türkçe açıkla. Kısa ve öz ol.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 128 },
        }),
      },
    );
    if (!response.ok) return "";
    const data = (await response.json()) as GeminiGenerateResponse;
    return (data.candidates[0]?.content.parts[0]?.text ?? "").trim();
  } catch {
    return "";
  }
}

// Re-export for use but suppress unused import warnings
void extractTableNames;
void extractCTENames;

// ── Router ────────────────────────────────────────────────────────────────────

export const cfoRouter = createTRPCRouter({
  /**
   * Ask the Virtual CFO a natural-language financial question.
   * Runs Gemini inference inline and returns the full result.
   */
  ask: companyProcedure
    .input(z.object({ question: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return {
          status: "rejected" as const,
          question: input.question,
          sql: "",
          reason: "GEMINI_API_KEY yapılandırılmamış. Lütfen yöneticinize bildirin.",
          rows: [],
          rowCount: 0,
          latencyMs: 0,
          explanation: "",
        };
      }

      // 1. Generate SQL from Gemini
      let generatedSql: string;
      try {
        generatedSql = await generateSQL(input.question, apiKey);
      } catch (err) {
        return {
          status: "rejected" as const,
          question: input.question,
          sql: "",
          reason: err instanceof Error ? err.message : "SQL üretme hatası",
          rows: [],
          rowCount: 0,
          latencyMs: Date.now() - startTime,
          explanation: "",
        };
      }

      // 2. Safety validation
      const validation = validateSQL(generatedSql);
      if (!validation.safe) {
        return {
          status: "rejected" as const,
          question: input.question,
          sql: generatedSql,
          reason: validation.reason ?? "Güvenlik doğrulaması başarısız",
          rows: [],
          rowCount: 0,
          latencyMs: Date.now() - startTime,
          explanation: "",
        };
      }

      // 3. Execute the validated query
      const pool = new Pool({
        connectionString: process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL,
      });

      let rows: Record<string, unknown>[] = [];
      let rowCount = 0;

      try {
        const result = await pool.query(generatedSql, [ctx.companyId]);
        rows = (result.rows as Record<string, unknown>[]).slice(0, 100);
        rowCount = result.rowCount ?? rows.length;
      } catch (err) {
        await pool.end();
        return {
          status: "rejected" as const,
          question: input.question,
          sql: generatedSql,
          reason: `SQL çalıştırma hatası: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`,
          rows: [],
          rowCount: 0,
          latencyMs: Date.now() - startTime,
          explanation: "",
        };
      }

      // 4. Generate explanation (non-blocking, best-effort)
      const [explanation] = await Promise.all([
        explainSQL(input.question, generatedSql, apiKey),
        // Log to ai_query_log (fire-and-forget, don't fail the request)
        pool.query(
          `INSERT INTO ai_query_log (company_id, user_id, query_text, response_text, model, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            ctx.companyId,
            ctx.userId,
            input.question,
            generatedSql,
            "gemini-2.0-flash",
            Date.now() - startTime,
          ],
        ).catch(() => null), // Don't fail if ai_query_log doesn't exist
      ]);

      await pool.end();

      return {
        status: "success" as const,
        question: input.question,
        sql: generatedSql,
        explanation,
        rows,
        rowCount,
        latencyMs: Date.now() - startTime,
      };
    }),

  /**
   * Approve a Q&A pair — saves it for future training improvement.
   */
  approve: companyProcedure
    .input(z.object({ question: z.string().min(3), sql: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      // Store the approved pair in vanna_training if the table exists
      await db.execute(
        sql`INSERT INTO vanna_training (company_id, question, sql, was_user_approved)
            VALUES (${ctx.companyId}, ${input.question}, ${input.sql}, true)
            ON CONFLICT DO NOTHING`,
      ).catch(() => null); // Silently skip if table doesn't exist yet

      return { success: true };
    }),

  /**
   * Recent AI query history for this company.
   */
  history: companyProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;

      const result = await db.execute(
        sql`SELECT id, query_text, response_text, model, tokens_used, latency_ms, created_at
            FROM ai_query_log
            WHERE company_id = ${ctx.companyId}
            ORDER BY created_at DESC
            LIMIT ${limit}`,
      ).catch(() => ({ rows: [] }));

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
