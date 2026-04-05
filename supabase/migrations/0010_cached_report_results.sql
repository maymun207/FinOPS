-- cached_report_results: Stores DuckDB query results with 1-hour TTL.
-- Architecture: Trigger.dev job → DuckDB → cache here → tRPC reads from cache

CREATE TABLE IF NOT EXISTS public.cached_report_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  UNIQUE(company_id, report_type)
);

-- Index for TTL-based cleanup and fast lookups
CREATE INDEX idx_cached_report_results_lookup
  ON public.cached_report_results (company_id, report_type, expires_at);

-- RLS: company-scoped access
ALTER TABLE public.cached_report_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY cached_report_results_company_read
  ON public.cached_report_results
  FOR SELECT
  USING (company_id = (current_setting('app.company_id', true))::uuid);

CREATE POLICY cached_report_results_service_role
  ON public.cached_report_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.cached_report_results IS
  'Cached DuckDB analytical view results. TTL: 1 hour. Written by Trigger.dev sync job.';
