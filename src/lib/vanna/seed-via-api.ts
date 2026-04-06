/**
 * seed-via-api.ts — Seed vanna_training using Gemini API for embeddings
 * and writing INSERT SQL to stdout for piping to Supabase MCP.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx src/lib/vanna/seed-via-api.ts > /tmp/seed-sql.json
 *
 * Outputs JSON array of { question, sql, embedding } for each pair.
 */

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

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set");
    process.exit(1);
  }

  const results: Array<{ question: string; sql: string; vectorStr: string }> =
    [];

  for (let i = 0; i < TRAINING_CORPUS.length; i++) {
    const pair = TRAINING_CORPUS[i];
    if (!pair) continue;

    // Rate limiting: 200ms between calls
    if (i > 0) await new Promise((r) => setTimeout(r, 200));

    process.stderr.write(
      `  [${i + 1}/${TRAINING_CORPUS.length}] "${pair.question.substring(0, 50)}..."\n`,
    );

    const embedding = await generateEmbedding(pair.question, apiKey);

    if (embedding.length !== 768) {
      process.stderr.write(
        `  ⚠️  Bad dimension: ${embedding.length}\n`,
      );
      continue;
    }

    results.push({
      question: pair.question,
      sql: pair.sql,
      vectorStr: `[${embedding.join(",")}]`,
    });
  }

  // Output JSON to stdout
  console.log(JSON.stringify(results, null, 0));
  process.stderr.write(
    `\n✅ Generated ${results.length} embeddings\n`,
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
