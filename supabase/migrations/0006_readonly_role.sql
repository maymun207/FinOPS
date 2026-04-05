-- Migration 0006: Readonly role for the Virtual CFO agent.
-- This role can SELECT from all tables but cannot INSERT, UPDATE, or DELETE.
-- Used by the AI query engine to run read-only SQL against the database.

-- ============================================================================
-- Create the finops_readonly role
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finops_readonly') THEN
    CREATE ROLE finops_readonly NOLOGIN;
  END IF;
END
$$;

-- Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO finops_readonly;

-- Grant SELECT on ALL existing tables (and future ones)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO finops_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO finops_readonly;

-- ============================================================================
-- Explicitly revoke write operations for defense-in-depth
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM finops_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM finops_readonly;

-- ============================================================================
-- Grant USAGE on sequences (needed for SELECT on tables with serial PKs)
-- ============================================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO finops_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO finops_readonly;
