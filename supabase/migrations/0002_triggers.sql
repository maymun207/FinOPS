-- Migration 0002: Hand-written triggers for accounting integrity
-- These cannot be expressed in Drizzle ORM and must be applied as raw SQL.

-- ============================================================================
-- Trigger 1: Balance constraint on journal_entry_lines
--
-- Ensures SUM(debit_amount) = SUM(credit_amount) for each journal entry.
--
-- CRITICAL: Uses CONSTRAINT TRIGGER with DEFERRABLE INITIALLY DEFERRED.
-- Without this, inserting the first line of a journal entry would always fail
-- because the debit side has no matching credit yet. The DEFERRABLE option
-- postpones the check to transaction COMMIT time, allowing all lines to be
-- inserted within a single transaction before the balance is verified.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit  NUMERIC;
  v_credit NUMERIC;
BEGIN
  -- SUM all lines for the journal_entry_id that was just inserted/updated
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO v_debit, v_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debit=% credit=%',
      NEW.journal_entry_id, v_debit, v_credit;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_journal_balance
  AFTER INSERT OR UPDATE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_journal_balance();


-- ============================================================================
-- Trigger 2: Fiscal period lock on journal_entries
--
-- Prevents INSERT or UPDATE on journal_entries when the associated
-- fiscal period is closed (is_closed = true).
-- Fires per-row (BEFORE) to reject the operation before it commits.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_fiscal_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_closed BOOLEAN;
BEGIN
  SELECT is_closed INTO v_closed
  FROM fiscal_periods
  WHERE id = NEW.fiscal_period_id;

  IF v_closed = TRUE THEN
    RAISE EXCEPTION 'Fiscal period % is closed — cannot insert/update journal entries',
      NEW.fiscal_period_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fiscal_period_lock
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_fiscal_period_lock();
