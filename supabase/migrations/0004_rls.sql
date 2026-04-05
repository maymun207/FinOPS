-- Migration 0004: Row Level Security (RLS) policies for all tables.
-- Enables tenant isolation using company_id / clerk_org_id.
--
-- Strategy:
--   - companies: filtered by clerk_org_id from JWT
--   - All child tables: filtered by company_id via public.get_company_id() helper
--   - audit_log: SELECT only, NO DELETE policy (append-only by design)
--   - ai_query_log: SELECT + INSERT only (append-only)

-- ============================================================================
-- Helper function: extract the company_id from the current JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT id FROM public.companies WHERE clerk_org_id = (
    (current_setting('request.jwt.claims', true)::json) ->> 'org_id'
  )
$$;

-- ============================================================================
-- Helper function: extract the user_id (Clerk sub) from the current JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (current_setting('request.jwt.claims', true)::json) ->> 'sub'
$$;

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_mapping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMPANIES (uses clerk_org_id directly from JWT)
-- ============================================================================

CREATE POLICY companies_select ON companies FOR SELECT
  USING (clerk_org_id = ((current_setting('request.jwt.claims', true)::json) ->> 'org_id'));
CREATE POLICY companies_insert ON companies FOR INSERT
  WITH CHECK (clerk_org_id = ((current_setting('request.jwt.claims', true)::json) ->> 'org_id'));
CREATE POLICY companies_update ON companies FOR UPDATE
  USING (clerk_org_id = ((current_setting('request.jwt.claims', true)::json) ->> 'org_id'))
  WITH CHECK (clerk_org_id = ((current_setting('request.jwt.claims', true)::json) ->> 'org_id'));
CREATE POLICY companies_delete ON companies FOR DELETE
  USING (clerk_org_id = ((current_setting('request.jwt.claims', true)::json) ->> 'org_id'));

-- ============================================================================
-- ALL CHILD TABLES (use public.get_company_id())
-- ============================================================================

CREATE POLICY fiscal_periods_select ON fiscal_periods FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY fiscal_periods_insert ON fiscal_periods FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY fiscal_periods_update ON fiscal_periods FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY fiscal_periods_delete ON fiscal_periods FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY chart_of_accounts_select ON chart_of_accounts FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY chart_of_accounts_insert ON chart_of_accounts FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY chart_of_accounts_update ON chart_of_accounts FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY chart_of_accounts_delete ON chart_of_accounts FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY contacts_select ON contacts FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY category_mappings_select ON category_mappings FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY category_mappings_insert ON category_mappings FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY category_mappings_update ON category_mappings FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY category_mappings_delete ON category_mappings FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY invoices_select ON invoices FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY invoices_update ON invoices FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY invoices_delete ON invoices FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY invoice_line_items_select ON invoice_line_items FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY invoice_line_items_insert ON invoice_line_items FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY invoice_line_items_update ON invoice_line_items FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY invoice_line_items_delete ON invoice_line_items FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY journal_entries_select ON journal_entries FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY journal_entries_insert ON journal_entries FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY journal_entries_update ON journal_entries FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY journal_entries_delete ON journal_entries FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY journal_entry_lines_select ON journal_entry_lines FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY journal_entry_lines_insert ON journal_entry_lines FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY journal_entry_lines_update ON journal_entry_lines FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY journal_entry_lines_delete ON journal_entry_lines FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY payments_select ON payments FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY payments_update ON payments FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY payments_delete ON payments FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY import_quarantine_select ON import_quarantine FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY import_quarantine_insert ON import_quarantine FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY import_quarantine_update ON import_quarantine FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY import_quarantine_delete ON import_quarantine FOR DELETE USING (company_id = public.get_company_id());

CREATE POLICY column_mapping_profiles_select ON column_mapping_profiles FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY column_mapping_profiles_insert ON column_mapping_profiles FOR INSERT WITH CHECK (company_id = public.get_company_id());
CREATE POLICY column_mapping_profiles_update ON column_mapping_profiles FOR UPDATE USING (company_id = public.get_company_id()) WITH CHECK (company_id = public.get_company_id());
CREATE POLICY column_mapping_profiles_delete ON column_mapping_profiles FOR DELETE USING (company_id = public.get_company_id());

-- AI_QUERY_LOG — append-only (no UPDATE/DELETE)
CREATE POLICY ai_query_log_select ON ai_query_log FOR SELECT USING (company_id = public.get_company_id());
CREATE POLICY ai_query_log_insert ON ai_query_log FOR INSERT WITH CHECK (company_id = public.get_company_id());

-- AUDIT_LOG — Append-only. No INSERT/UPDATE/DELETE policies for end users.
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (company_id = public.get_company_id());
