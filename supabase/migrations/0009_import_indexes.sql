-- ==========================================================================
-- Migration 0009: Import pipeline indexes
-- Optimizes quarantine queries and profile fingerprint matching
-- ==========================================================================

-- Index for quarantine listing by company + status (main query pattern)
CREATE INDEX IF NOT EXISTS idx_import_quarantine_company_status
  ON import_quarantine (company_id, status);

-- Index for quarantine listing ordered by created_at (pagination)
CREATE INDEX IF NOT EXISTS idx_import_quarantine_created_at
  ON import_quarantine (created_at DESC);

-- Index for profile fingerprint auto-matching
CREATE INDEX IF NOT EXISTS idx_mapping_profiles_fingerprint
  ON column_mapping_profiles (company_id, file_fingerprint);

-- Index for profile listing by company
CREATE INDEX IF NOT EXISTS idx_mapping_profiles_company
  ON column_mapping_profiles (company_id);
