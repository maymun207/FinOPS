/**
 * vanna-training-update — Trigger.dev task for adding approved Q&A pairs.
 *
 * When a user approves a generated SQL query, or manually adds a
 * training pair, this task:
 *   1. Generates an embedding for the question via Gemini
 *   2. Inserts the Q&A pair + embedding into vanna_training
 *   3. The new pair will be included in future pgvector similarity searches
 */
import { task, logger } from "@trigger.dev/sdk/v3";
import { Pool } from "pg";

interface GeminiEmbeddingResponse {
  embedding: { values: number[] };
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  return data.embedding.values;
}

export const vannaTrainingUpdateTask = task({
  id: "vanna-training-update",
  retry: { maxAttempts: 2, factor: 2 },
  run: async (payload: {
    companyId: string | null;
    question: string;
    sql: string;
    wasUserApproved: boolean;
  }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    logger.info("Generating embedding for training pair", {
      question: payload.question.substring(0, 100),
    });

    // 1. Generate embedding
    const embedding = await generateEmbedding(payload.question, apiKey);
    const vectorStr = `[${embedding.join(",")}]`;

    // 2. Insert into vanna_training
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO vanna_training (company_id, question, sql, embedding, was_user_approved)
         VALUES ($1, $2, $3, $4::vector, $5)
         RETURNING id`,
        [
          payload.companyId,
          payload.question,
          payload.sql,
          vectorStr,
          payload.wasUserApproved,
        ],
      );

      const insertedId = result.rows[0]?.id;
      logger.info("Training pair inserted", { id: insertedId });

      return {
        status: "inserted" as const,
        id: insertedId,
        embeddingDimensions: embedding.length,
      };
    } finally {
      await pool.end();
    }
  },
});
