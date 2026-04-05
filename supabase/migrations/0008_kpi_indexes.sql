-- ==========================================================
-- Migration 0008: KPI performance indexes
-- ==========================================================
-- Optimizes dashboard KPI aggregation queries.
-- Indexes target the specific WHERE clauses used by
-- the dashboard.getKPIs tRPC router.
-- ==========================================================

-- ── Invoice aggregation queries ───────────────────────────
-- Used by: SUM(grand_total) WHERE company_id=X AND direction=Y
CREATE INDEX IF NOT EXISTS idx_invoices_company_direction
  ON invoices (company_id, direction);

-- Used by: SUM(grand_total) WHERE company_id=X AND direction=Y AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_invoices_company_direction_status
  ON invoices (company_id, direction, status);

-- Used by: period-scoped revenue queries
CREATE INDEX IF NOT EXISTS idx_invoices_company_period_direction
  ON invoices (company_id, fiscal_period_id, direction);

-- ── Journal entry line aggregation ────────────────────────
-- Used by: COUNT(*) WHERE company_id=X
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_company
  ON journal_entry_lines (company_id);

-- ── Contact count ─────────────────────────────────────────
-- Used by: COUNT(*) WHERE company_id=X
CREATE INDEX IF NOT EXISTS idx_contacts_company
  ON contacts (company_id);

-- ── Fiscal period lookup ──────────────────────────────────
-- Used by: open period queries with date range
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_company_open
  ON fiscal_periods (company_id, is_closed, start_date, end_date);
