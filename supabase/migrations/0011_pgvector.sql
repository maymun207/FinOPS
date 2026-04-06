-- 0011_pgvector.sql
-- Enable pgvector extension for embedding similarity search
-- Used by the Virtual CFO RAG pipeline

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE vanna_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),  -- NULL = global seed
  question TEXT NOT NULL,
  sql TEXT NOT NULL,
  embedding vector(768),  -- Gemini gemini-embedding-001 dimension
  was_user_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX idx_vanna_training_embedding
  ON vanna_training USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Composite index for company-scoped lookups
CREATE INDEX idx_vanna_training_company
  ON vanna_training (company_id)
  WHERE company_id IS NOT NULL;

-- RLS policy: users can read global + own company training data
ALTER TABLE vanna_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY vanna_training_read ON vanna_training
  FOR SELECT
  USING (
    company_id IS NULL
    OR company_id = (current_setting('app.company_id', true))::uuid
  );

CREATE POLICY vanna_training_insert ON vanna_training
  FOR INSERT
  WITH CHECK (
    company_id = (current_setting('app.company_id', true))::uuid
  );

-- service_role bypass — used by Trigger.dev jobs (vanna-inference, vanna-training-update)
CREATE POLICY vanna_training_service_role ON vanna_training
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
