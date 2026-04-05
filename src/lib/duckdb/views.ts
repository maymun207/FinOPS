/**
 * DuckDB reporting view definitions — 7 analytical views.
 *
 * Views:
 *   1. v_trial_balance       — Mizan (opening/period/closing debit & credit)
 *   2. v_income_statement    — Gelir Tablosu (revenue − expense)
 *   3. v_balance_sheet       — Bilanço (assets / liabilities / equity)
 *   4. v_aging_receivables   — Alacak Yaşlandırma (DATEDIFF buckets)
 *   5. v_monthly_cashflow    — Aylık Nakit Akışı (monthly cash in/out)
 *   6. v_kdv_summary         — KDV Özeti (VAT grouped by rate)
 *   7. v_contact_ledger      — Cari Hesap Özeti (running balance per contact)
 */

/**
 * SQL for trial balance (Mizan).
 * Includes opening_debit, opening_credit, period_debit, period_credit,
 * closing_debit, closing_credit, and net_balance.
 */
export const V_TRIAL_BALANCE = `
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  jel.account_code,
  coa.name AS account_name,
  coa.account_type,
  coa.normal_balance,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))  AS opening_debit,
  SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS opening_credit,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))  AS period_debit,
  SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS period_credit,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))  AS closing_debit,
  SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS closing_credit,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))
    - SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS net_balance
FROM journal_entry_lines jel
LEFT JOIN chart_of_accounts coa
  ON jel.account_code = coa.code
  AND (coa.company_id = jel.company_id OR coa.company_id IS NULL)
GROUP BY jel.account_code, coa.name, coa.account_type, coa.normal_balance
ORDER BY jel.account_code;
`;

/**
 * SQL for income statement (Gelir Tablosu).
 * Revenue accounts (6xx) minus expense accounts (7xx).
 */
export const V_INCOME_STATEMENT = `
CREATE OR REPLACE VIEW v_income_statement AS
SELECT
  coa.account_type,
  jel.account_code,
  coa.name AS account_name,
  SUM(CAST(jel.credit_amount AS DECIMAL(18,2)))
    - SUM(CAST(jel.debit_amount AS DECIMAL(18,2))) AS net_amount
FROM journal_entry_lines jel
LEFT JOIN chart_of_accounts coa
  ON jel.account_code = coa.code
  AND (coa.company_id = jel.company_id OR coa.company_id IS NULL)
WHERE coa.account_type IN ('revenue', 'expense')
GROUP BY coa.account_type, jel.account_code, coa.name
ORDER BY jel.account_code;
`;

/**
 * SQL for balance sheet (Bilanço).
 * Assets (1xx), liabilities (3xx), equity (5xx).
 */
export const V_BALANCE_SHEET = `
CREATE OR REPLACE VIEW v_balance_sheet AS
SELECT
  coa.account_type,
  jel.account_code,
  coa.name AS account_name,
  CASE
    WHEN coa.normal_balance = 'debit' THEN
      SUM(CAST(jel.debit_amount AS DECIMAL(18,2))) - SUM(CAST(jel.credit_amount AS DECIMAL(18,2)))
    ELSE
      SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) - SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))
  END AS balance
FROM journal_entry_lines jel
LEFT JOIN chart_of_accounts coa
  ON jel.account_code = coa.code
  AND (coa.company_id = jel.company_id OR coa.company_id IS NULL)
WHERE coa.account_type IN ('asset', 'liability', 'equity')
GROUP BY coa.account_type, jel.account_code, coa.name, coa.normal_balance
ORDER BY jel.account_code;
`;

/**
 * SQL for aging receivables (Alacak Yaşlandırma).
 * Uses DATEDIFF(day, due_date, CURRENT_DATE) for days overdue.
 * Buckets: 0-30, 31-60, 61-90, 90+ days.
 */
export const V_AGING_RECEIVABLES = `
CREATE OR REPLACE VIEW v_aging_receivables AS
SELECT
  i.contact_id,
  c.name AS contact_name,
  SUM(CASE WHEN DATEDIFF('day', CAST(i.due_date AS DATE), CURRENT_DATE) BETWEEN 0 AND 30
    THEN CAST(i.grand_total AS DECIMAL(18,2)) ELSE 0 END) AS bucket_0_30,
  SUM(CASE WHEN DATEDIFF('day', CAST(i.due_date AS DATE), CURRENT_DATE) BETWEEN 31 AND 60
    THEN CAST(i.grand_total AS DECIMAL(18,2)) ELSE 0 END) AS bucket_31_60,
  SUM(CASE WHEN DATEDIFF('day', CAST(i.due_date AS DATE), CURRENT_DATE) BETWEEN 61 AND 90
    THEN CAST(i.grand_total AS DECIMAL(18,2)) ELSE 0 END) AS bucket_61_90,
  SUM(CASE WHEN DATEDIFF('day', CAST(i.due_date AS DATE), CURRENT_DATE) > 90
    THEN CAST(i.grand_total AS DECIMAL(18,2)) ELSE 0 END) AS bucket_90_plus,
  SUM(CAST(i.grand_total AS DECIMAL(18,2))) AS total_receivable
FROM invoices i
LEFT JOIN contacts c ON i.contact_id = c.id
WHERE i.direction = 'outbound'
  AND i.status NOT IN ('PAID', 'CANCELLED')
GROUP BY i.contact_id, c.name
ORDER BY total_receivable DESC;
`;

/**
 * SQL for monthly cash flow (Aylık Nakit Akışı).
 * Uses journal entries on cash/bank accounts (100, 101, 102).
 */
export const V_MONTHLY_CASHFLOW = `
CREATE OR REPLACE VIEW v_monthly_cashflow AS
SELECT
  EXTRACT(YEAR FROM CAST(je.date AS DATE))  AS year,
  EXTRACT(MONTH FROM CAST(je.date AS DATE)) AS month,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))  AS cash_in,
  SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS cash_out,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)))
    - SUM(CAST(jel.credit_amount AS DECIMAL(18,2))) AS net_flow
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE jel.account_code IN ('100', '101', '102')
GROUP BY
  EXTRACT(YEAR FROM CAST(je.date AS DATE)),
  EXTRACT(MONTH FROM CAST(je.date AS DATE))
ORDER BY year, month;
`;

/**
 * SQL for KDV summary (KDV Özeti).
 * Groups invoices by KDV rate, summing subtotal and KDV total.
 */
export const V_KDV_SUMMARY = `
CREATE OR REPLACE VIEW v_kdv_summary AS
SELECT
  CASE
    WHEN CAST(i.subtotal AS DECIMAL(18,2)) > 0 THEN
      ROUND(CAST(i.kdv_total AS DECIMAL(18,2)) / CAST(i.subtotal AS DECIMAL(18,2)) * 100, 0)
    ELSE 0
  END AS kdv_rate,
  COUNT(*) AS invoice_count,
  SUM(CAST(i.subtotal AS DECIMAL(18,2)))   AS total_subtotal,
  SUM(CAST(i.kdv_total AS DECIMAL(18,2)))  AS total_kdv,
  SUM(CAST(i.grand_total AS DECIMAL(18,2))) AS total_grand
FROM invoices i
WHERE i.status NOT IN ('CANCELLED')
GROUP BY kdv_rate
ORDER BY kdv_rate;
`;

/**
 * SQL for contact ledger (Cari Hesap Özeti).
 * Running balance per contact using window function.
 * SUM(debit - credit) OVER (PARTITION BY contact_id ORDER BY entry_date, id)
 */
export const V_CONTACT_LEDGER = `
CREATE OR REPLACE VIEW v_contact_ledger AS
SELECT
  jel.company_id,
  i.contact_id,
  c.name AS contact_name,
  je.id AS entry_id,
  je.date AS entry_date,
  je.description,
  CAST(jel.debit_amount AS DECIMAL(18,2))  AS debit,
  CAST(jel.credit_amount AS DECIMAL(18,2)) AS credit,
  SUM(CAST(jel.debit_amount AS DECIMAL(18,2)) - CAST(jel.credit_amount AS DECIMAL(18,2)))
    OVER (PARTITION BY i.contact_id ORDER BY je.date, je.id) AS running_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
JOIN invoices i ON je.invoice_id = i.id
JOIN contacts c ON i.contact_id = c.id
ORDER BY i.contact_id, je.date, je.id;
`;

/**
 * All view definitions in order.
 */
export const ALL_VIEWS = [
  { name: "v_trial_balance", sql: V_TRIAL_BALANCE },
  { name: "v_income_statement", sql: V_INCOME_STATEMENT },
  { name: "v_balance_sheet", sql: V_BALANCE_SHEET },
  { name: "v_aging_receivables", sql: V_AGING_RECEIVABLES },
  { name: "v_monthly_cashflow", sql: V_MONTHLY_CASHFLOW },
  { name: "v_kdv_summary", sql: V_KDV_SUMMARY },
  { name: "v_contact_ledger", sql: V_CONTACT_LEDGER },
] as const;
