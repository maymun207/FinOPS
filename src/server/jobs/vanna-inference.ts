/**
 * vanna-inference — Trigger.dev task for Virtual CFO SQL inference.
 *
 * Pipeline:
 *   1. Accept user's natural-language question
 *   2. Generate embedding via Gemini text-embedding-004
 *   3. Find top-5 similar Q&A pairs from pgvector (cosine similarity)
 *   4. Build few-shot prompt with schema context + similar examples
 *   5. Generate SQL via Gemini 2.0 Flash
 *   6. Validate safety (SELECT-only, no dangerous functions)
 *   7. Execute against read-only connection
 *   8. Return { sql, rows, explanation }
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { Pool } from "pg";
import { SYSTEM_PROMPT } from "@/lib/vanna/schema-context";

// ── Gemini API types ───────────────────────────────────────────────

interface GeminiEmbeddingResponse {
  embedding: { values: number[] };
}

interface GeminiGenerateResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

// ── Safety validation ──────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i,
  /\b(pg_sleep|dblink|COPY|lo_import|lo_export)\b/i,
  /\b(pg_read_file|pg_write_file)\b/i,
  /;.*;/,  // multiple statements
];

export function validateSQL(sql: string): { safe: boolean; reason?: string } {
  const trimmed = sql.trim();

  // Must start with SELECT or WITH
  if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) {
    return { safe: false, reason: "Query must start with SELECT or WITH" };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Dangerous pattern detected: ${pattern.source}` };
    }
  }

  // Must contain company_id filter
  if (!/company_id/i.test(trimmed)) {
    return { safe: false, reason: "Query must include company_id filter" };
  }

  return { safe: true };
}

// ── Gemini helpers ─────────────────────────────────────────────────

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  return data.embedding.values;
}

async function generateSQL(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini generation failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const rawText = data.candidates[0]?.content.parts[0]?.text ?? "";

  // Extract SQL from markdown code blocks if present
  const codeBlockMatch = rawText.match(/```(?:sql)?\s*([\s\S]*?)```/);
  return (codeBlockMatch?.[1] ?? rawText).trim();
}

// ── Similar Q&A lookup via pgvector ────────────────────────────────

interface SimilarPair {
  question: string;
  sql: string;
  similarity: number;
}

async function findSimilarQuestions(
  embedding: number[],
  companyId: string,
  pool: Pool,
  limit = 5,
): Promise<SimilarPair[]> {
  const vectorStr = `[${embedding.join(",")}]`;

  const result = await pool.query<{ question: string; sql: string; similarity: number }>(
    `SELECT
       question,
       sql,
       1 - (embedding <=> $1::vector) AS similarity
     FROM vanna_training
     WHERE (company_id IS NULL OR company_id = $2)
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, companyId, limit],
  );

  return result.rows;
}

// ── Task definition ────────────────────────────────────────────────

export const vannaInferenceTask = task({
  id: "vanna-inference",
  retry: { maxAttempts: 1 },
  run: async (payload: {
    question: string;
    companyId: string;
    userId: string;
  }) => {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    logger.info("Starting Vanna inference", { question: payload.question });

    // 1. Generate embedding for the user's question
    const embedding = await generateEmbedding(payload.question, apiKey);
    logger.info("Embedding generated", { dimensions: embedding.length });

    // 2. Find similar training pairs via pgvector
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const similar = await findSimilarQuestions(
        embedding,
        payload.companyId,
        pool,
      );
      logger.info("Similar pairs found", { count: similar.length });

      // 3. Build few-shot prompt
      let fewShotExamples = "";
      if (similar.length > 0) {
        fewShotExamples = "\n\nBenzer sorular ve SQL örnekleri:\n";
        for (const pair of similar) {
          fewShotExamples += `\nSoru: ${pair.question}\nSQL:\n${pair.sql}\n`;
        }
      }

      const userPrompt = `${fewShotExamples}

Şimdi aşağıdaki soruyu SQL sorgusuna çevir. company_id yerine $1 parametre kullan.

Soru: ${payload.question}
SQL:`;

      // 4. Generate SQL via Gemini
      const generatedSQL = await generateSQL(userPrompt, apiKey);
      logger.info("SQL generated", { sql: generatedSQL.substring(0, 200) });

      // 5. Validate safety
      const validation = validateSQL(generatedSQL);
      if (!validation.safe) {
        logger.warn("Generated SQL failed safety check", { reason: validation.reason });
        return {
          status: "rejected" as const,
          question: payload.question,
          sql: generatedSQL,
          reason: validation.reason,
          rows: [],
          latencyMs: Date.now() - startTime,
        };
      }

      // 6. Execute the query (read-only)
      const queryResult = await pool.query(generatedSQL, [payload.companyId]);
      logger.info("Query executed", { rowCount: queryResult.rowCount });

      // 7. Log to ai_query_log
      await pool.query(
        `INSERT INTO ai_query_log (company_id, user_id, query_text, response_text, model, tokens_used, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payload.companyId,
          payload.userId,
          payload.question,
          generatedSQL,
          "gemini-2.0-flash",
          null, // Gemini doesn't return token counts in REST API
          Date.now() - startTime,
        ],
      );

      return {
        status: "success" as const,
        question: payload.question,
        sql: generatedSQL,
        rows: queryResult.rows.slice(0, 100),
        rowCount: queryResult.rowCount ?? 0,
        similarityScore: similar[0]?.similarity ?? 0,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      await pool.end();
    }
  },
});
