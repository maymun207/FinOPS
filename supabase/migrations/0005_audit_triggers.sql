-- Migration 0005: Audit log trigger function + per-table triggers.
-- Fires AFTER INSERT, UPDATE, DELETE on all auditable tables.
-- Captures old_data, new_data, user_id (from JWT), ip_address, and table_name.
--
-- The trigger function runs as SECURITY DEFINER to bypass RLS on audit_log,
-- allowing it to write even though end-users have no INSERT policy.
--
-- Do NOT apply to audit_log itself (infinite recursion) or
-- import_quarantine (too noisy — log only promotions).

-- ============================================================================
-- Audit trigger function (for tables with company_id column)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id text;
BEGIN
  BEGIN
    v_user_id := current_setting('request.jwt.claims', true)::json ->> 'sub';
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO public.audit_log (company_id, table_name, record_id, action, old_data, new_data, user_id, ip_address)
  VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_user_id,
    inet_client_addr()::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- Special trigger for companies table (id IS the company_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_trigger_companies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id text;
BEGIN
  BEGIN
    v_user_id := current_setting('request.jwt.claims', true)::json ->> 'sub';
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO public.audit_log (company_id, table_name, record_id, action, old_data, new_data, user_id, ip_address)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_user_id,
    inet_client_addr()::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- Per-table triggers
-- ============================================================================

-- companies (uses special trigger — id IS company_id)
CREATE TRIGGER trg_audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_companies();

-- fiscal_periods
CREATE TRIGGER trg_audit_fiscal_periods
  AFTER INSERT OR UPDATE OR DELETE ON fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- chart_of_accounts
CREATE TRIGGER trg_audit_chart_of_accounts
  AFTER INSERT OR UPDATE OR DELETE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- contacts
CREATE TRIGGER trg_audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- category_mappings
CREATE TRIGGER trg_audit_category_mappings
  AFTER INSERT OR UPDATE OR DELETE ON category_mappings
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- invoices
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- invoice_line_items
CREATE TRIGGER trg_audit_invoice_line_items
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- journal_entries
CREATE TRIGGER trg_audit_journal_entries
  AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- journal_entry_lines
CREATE TRIGGER trg_audit_journal_entry_lines
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- payments
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- column_mapping_profiles
CREATE TRIGGER trg_audit_column_mapping_profiles
  AFTER INSERT OR UPDATE OR DELETE ON column_mapping_profiles
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ai_query_log
CREATE TRIGGER trg_audit_ai_query_log
  AFTER INSERT OR UPDATE OR DELETE ON ai_query_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- NOTE: No trigger on audit_log itself (prevent infinite recursion).
-- NOTE: No trigger on import_quarantine (too noisy — log only promotions).
