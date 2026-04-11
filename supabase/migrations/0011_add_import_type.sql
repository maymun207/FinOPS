-- Migration: Add import_type column to import_quarantine
-- This column tracks whether a quarantine record is an invoice, contact, or journal entry.
-- Required for the promotion logic that moves approved records into live tables.

ALTER TABLE import_quarantine
  ADD COLUMN IF NOT EXISTS import_type varchar(20);

-- Update existing records to have a default (if any exist)
-- They would have been inserted without the column, so we leave them as NULL.

-- Index for filtering by import type
CREATE INDEX IF NOT EXISTS idx_import_quarantine_import_type
  ON import_quarantine (company_id, import_type, status);
