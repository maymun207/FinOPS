-- Migration 0013: Capture all live DB fixes that were applied directly and
-- never written back to migration files. Running migrations from scratch
-- without this file would produce a broken database.
--
-- Changes captured:
--   1. audit_log.company_id → make nullable + fix FK to ON DELETE SET NULL
--   2. journal_entry_lines.company_id → add missing column + FK
--   3. chart_of_accounts unique index → NULLS NOT DISTINCT (deduplication)
--   4. audit_log_trigger() → updated version with JWT crash fix + FK exception handler
--   5. audit_log_trigger_companies() → updated version with circular FK fix (NULL company_id)

-- ============================================================================
-- 1. Fix audit_log.company_id: NOT NULL → nullable, ON DELETE cascade → SET NULL
--    Reason: companies trigger fires after company DELETE; audit row must survive.
-- ============================================================================

-- Drop old FK (was ON DELETE cascade)
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_company_id_companies_id_fk;

-- Make company_id nullable (companies trigger sets it to NULL on company DELETE)
ALTER TABLE public.audit_log
  ALTER COLUMN company_id DROP NOT NULL;

-- Re-add FK with ON DELETE SET NULL
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES public.companies(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- ============================================================================
-- 2. Add journal_entry_lines.company_id (added for RLS filtering + tenant isolation)
--    Reason: RLS policies, indexes, and the audit trigger all reference this column,
--    but it was never in the original CREATE TABLE migration.
-- ============================================================================

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Backfill from parent journal_entries (for any existing rows)
UPDATE public.journal_entry_lines jel
SET company_id = je.company_id
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND jel.company_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.journal_entry_lines
  ALTER COLUMN company_id SET NOT NULL;

-- ============================================================================
-- 3. chart_of_accounts unique index with NULLS NOT DISTINCT
--    Reason: Without NULLS NOT DISTINCT, (code, NULL) is not considered duplicate,
--    so the system-template rows (company_id IS NULL) get duplicated on every seed run.
-- ============================================================================

-- Drop old constraint/index (may exist as either depending on how it was created)
ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_code_company_id_unique;

DROP INDEX IF EXISTS public.chart_of_accounts_code_company_id_unique;

CREATE UNIQUE INDEX chart_of_accounts_code_company_id_unique
  ON public.chart_of_accounts (code, company_id) NULLS NOT DISTINCT;

-- ============================================================================
-- 4. Replace audit_log_trigger() with the production-hardened version
--    Changes vs 0005_audit_triggers.sql:
--    - JWT parse: handles empty string (pooler sends '' not NULL)
--    - Falls back to current_user when JWT unavailable (avoids NULL user_id)
--    - Skips audit for system-template rows (company_id IS NULL)
--    - Wraps INSERT in exception block → audit failure never blocks business ops
--    - Catches foreign_key_violation (company deleted mid-transaction)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id   text;
  v_company_id uuid;
  v_jwt_raw   text;
BEGIN
  -- Safely extract JWT sub — empty string or missing jwt must not throw
  BEGIN
    v_jwt_raw := current_setting('request.jwt.claims', true);
    IF v_jwt_raw IS NOT NULL AND v_jwt_raw <> '' THEN
      v_user_id := v_jwt_raw::json->>'sub';
    ELSE
      v_user_id := current_user;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := current_user;
  END;

  v_company_id := COALESCE(NEW.company_id, OLD.company_id);

  -- Skip audit for system-default template rows (company_id IS NULL)
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Wrap in exception block so audit failures never block business operations
  BEGIN
    INSERT INTO public.audit_log (company_id, table_name, record_id, action, old_data, new_data, user_id, ip_address)
    VALUES (
      v_company_id,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      TG_OP,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      v_user_id,
      inet_client_addr()::text
    );
  EXCEPTION WHEN foreign_key_violation THEN
    -- company was deleted before this trigger fired; skip audit silently
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- 5. Replace audit_log_trigger_companies() with the fixed version
--    Changes vs 0005_audit_triggers.sql:
--    - Stores NULL as company_id (was: COALESCE(NEW.id, OLD.id))
--    - Reason: The companies table IS the company — using its own id as company_id
--      creates a circular FK reference that fires before the company row exists.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_log_trigger_companies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_user_id text;
BEGIN
  BEGIN
    v_user_id := current_setting('request.jwt.claims', true)::json->>'sub';
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO public.audit_log (company_id, table_name, record_id, action, old_data, new_data, user_id, ip_address)
  VALUES (
    -- For the companies table itself, company_id would be a circular self-reference,
    -- so we store NULL. For all other tables, use the row's company_id field.
    NULL,
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
