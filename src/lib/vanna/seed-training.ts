/**
 * seed-training.ts — One-shot script to seed the vanna_training table.
 *
 * Reads all 50 Q&A pairs from training-corpus.ts, generates embeddings
 * via Gemini gemini-embedding-001, and inserts them into Supabase.
 *
 * Usage:
 *   npx tsx src/lib/vanna/seed-training.ts
 *
 * Requires env vars:
 *   DATABASE_URL   — Supabase connection string
 *   GEMINI_API_KEY — Google AI API key
 *
 * Idempotent: skips pairs that already exist (by question text).
 */

import { Pool } from "pg";
import { TRAINING_CORPUS } from "./training-corpus";

interface GeminiEmbeddingResponse {
  embedding: { values: number[] };
}

async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[]> {
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
    throw new Error(
      `Gemini embedding failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  return data.embedding.values;
}

async function seed() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL or SUPABASE_DB_URL not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Check current count
    const { rows: countRows } = await pool.query<{ cnt: string }>(
      "SELECT COUNT(*)::text as cnt FROM vanna_training",
    );
    const existingCount = parseInt(countRows[0]?.cnt ?? "0", 10);
    console.log(`📊 Current vanna_training rows: ${existingCount}`);

    if (existingCount >= 50) {
      console.log("✅ Already seeded (50+ rows). Skipping.");
      return;
    }

    // Get existing questions to skip duplicates
    const { rows: existingRows } = await pool.query<{ question: string }>(
      "SELECT question FROM vanna_training",
    );
    const existingQuestions = new Set(
      existingRows.map((r) => r.question.toLowerCase().trim()),
    );

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < TRAINING_CORPUS.length; i++) {
      const pair = TRAINING_CORPUS[i];
      if (!pair) continue;

      // Skip if already exists
      if (existingQuestions.has(pair.question.toLowerCase().trim())) {
        skipped++;
        continue;
      }

      // Rate limiting: 1 request per 200ms (< 5 RPS, well under Gemini limits)
      if (i > 0) await new Promise((r) => setTimeout(r, 200));

      try {
        console.log(
          `  [${i + 1}/${TRAINING_CORPUS.length}] Embedding: "${pair.question.substring(0, 60)}..."`,
        );

        const embedding = await generateEmbedding(pair.question, apiKey);

        if (embedding.length !== 768) {
          console.error(
            `  ⚠️  Unexpected dimension: ${embedding.length} (expected 768)`,
          );
          continue;
        }

        const vectorStr = `[${embedding.join(",")}]`;

        await pool.query(
          `INSERT INTO vanna_training (company_id, question, sql, embedding, was_user_approved)
           VALUES ($1, $2, $3, $4::vector, $5)
           ON CONFLICT DO NOTHING`,
          [null, pair.question, pair.sql, vectorStr, false],
        );

        inserted++;
      } catch (err) {
        console.error(
          `  ❌ Failed to seed pair "${pair.question}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Final count
    const { rows: finalRows } = await pool.query<{ cnt: string }>(
      "SELECT COUNT(*)::text as cnt FROM vanna_training",
    );
    const finalCount = parseInt(finalRows[0]?.cnt ?? "0", 10);

    console.log(`\n✅ Seeding complete:`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Total:    ${finalCount}`);

    // Verify embedding dimension
    const { rows: dimRows } = await pool.query<{ dim: number }>(
      "SELECT vector_dims(embedding) as dim FROM vanna_training LIMIT 1",
    );
    if (dimRows[0]) {
      console.log(`   Embedding dims: ${dimRows[0].dim}`);
    }
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
