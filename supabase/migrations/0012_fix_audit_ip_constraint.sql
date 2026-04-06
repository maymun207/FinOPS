-- Fix the IP address check constraint to allow CIDR notation (e.g., /128 suffix)
-- The current constraint rejects IPv6 addresses with subnet masks from pooler connections
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS chk_ip_address_format;

ALTER TABLE public.audit_log ADD CONSTRAINT chk_ip_address_format
  CHECK (
    ip_address IS NULL 
    OR ip_address ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(/\d{1,2})?$'
    OR ip_address ~ '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(/\d{1,3})?$'
  );
