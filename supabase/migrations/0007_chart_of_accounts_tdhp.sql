-- Migration 0007: TDHP template support
--
-- 1. Add normal_balance column (debit/credit)
-- 2. Add parent_code column (template hierarchy)
-- 3. Make company_id nullable (NULL = system-default template)
-- 4. Update RLS to allow reading template rows
-- 5. Update audit trigger to skip NULL company_id rows

-- Add new columns
ALTER TABLE chart_of_accounts
ADD COLUMN IF NOT EXISTS normal_balance varchar(6);

ALTER TABLE chart_of_accounts
ADD COLUMN IF NOT EXISTS parent_code varchar(20);

-- Make company_id nullable for template records
ALTER TABLE chart_of_accounts ALTER COLUMN company_id DROP NOT NULL;

-- Update RLS policy to allow reading template rows (company_id IS NULL)
DROP POLICY IF EXISTS chart_of_accounts_select ON chart_of_accounts;
CREATE POLICY chart_of_accounts_select ON chart_of_accounts FOR SELECT
  USING (company_id IS NULL OR company_id = public.get_company_id());

-- Update audit trigger to skip rows with NULL company_id (system templates)
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
  v_company_id uuid;
BEGIN
  v_user_id := coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_user
  );

  v_company_id := COALESCE(NEW.company_id, OLD.company_id);

  -- Skip audit for system-default template rows (company_id IS NULL)
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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

  RETURN COALESCE(NEW, OLD);
END;
$$;
