/**
 * Schema Context — FinOPS database schema description for the Virtual CFO system prompt.
 *
 * Provides a compact, human-readable DDL summary of all tables, columns,
 * and relationships to feed into the LLM as context for SQL generation.
 *
 * This is NOT raw DDL — it's a curated description optimized for token
 * efficiency while preserving the semantic information the model needs.
 *
 * IMPORTANT: Keep this in sync with the actual Supabase schema.
 * Last synced: 2026-04-08 from information_schema.columns.
 */

export const SCHEMA_CONTEXT = `
-- FinOPS Database Schema (Supabase/PostgreSQL)
-- Multi-tenant financial accounting system for Turkish businesses
-- All monetary values are NUMERIC in TRY (Turkish Lira)
-- Multi-tenant isolation via company_id FK on all tables

-- companies: each Clerk organization maps to one company
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  clerk_org_id TEXT UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  legal_name VARCHAR,
  tax_id VARCHAR(11),
  base_currency VARCHAR DEFAULT 'TRY',
  e_fatura_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- fiscal_periods: accounting periods (typically monthly)
CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name VARCHAR NOT NULL,           -- e.g. "Ocak 2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- chart_of_accounts: TDHP (Tekdüzen Hesap Planı) standard accounts
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  code VARCHAR(10) NOT NULL,    -- e.g. "100", "320", "600"
  name VARCHAR NOT NULL,         -- e.g. "Kasa", "Satıcılar", "Yurt İçi Satışlar"
  account_type VARCHAR(20),     -- asset, liability, equity, revenue, expense
  normal_balance VARCHAR(10),   -- debit or credit
  is_active BOOLEAN DEFAULT true,
  parent_id UUID,               -- hierarchical parent (self-ref)
  parent_code VARCHAR(10),      -- parent account code
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- contacts: müşteri (customer) / tedarikçi (supplier) records
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name VARCHAR NOT NULL,
  tax_id VARCHAR(11),
  type VARCHAR(20),              -- customer, supplier, both
  email VARCHAR,
  phone VARCHAR,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- invoices: sales & purchase invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  invoice_number VARCHAR NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  direction VARCHAR(20),         -- sales, purchase
  currency VARCHAR DEFAULT 'TRY',
  subtotal NUMERIC(15,2) DEFAULT 0,
  kdv_total NUMERIC(15,2) DEFAULT 0,       -- VAT total amount
  grand_total NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',      -- draft, sent, paid, overdue, cancelled
  gib_uuid VARCHAR,              -- e-invoice UUID
  gib_status VARCHAR,            -- e-invoice status
  gib_ettn VARCHAR,              -- e-invoice ETTN number
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- invoice_line_items: individual items per invoice
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  subtotal NUMERIC(15,2),                  -- quantity * unit_price
  kdv_rate NUMERIC(5,2) DEFAULT 20,        -- VAT rate (1, 10, 20)
  kdv_amount NUMERIC(15,2),                -- calculated VAT amount
  total NUMERIC(15,2),                     -- subtotal + kdv_amount
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- journal_entries: yevmiye defteri header
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  entry_date DATE NOT NULL,
  description TEXT,
  source_type VARCHAR(20),       -- manual, invoice, payment, import
  source_id UUID,                -- FK to source record (invoice_id, payment_id, etc.)
  created_by TEXT,               -- user who created the entry
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- journal_entry_lines: individual debit/credit lines (double-entry)
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  company_id UUID,
  account_id UUID REFERENCES chart_of_accounts(id),   -- FK to chart_of_accounts
  debit_amount NUMERIC(15,2) DEFAULT 0,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- payments: ödeme kayıtları
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  contact_id UUID REFERENCES contacts(id),
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR DEFAULT 'TRY',
  payment_date DATE NOT NULL,
  method VARCHAR(20),            -- cash, bank_transfer, check, credit_card
  reference VARCHAR,             -- check number, transfer reference, etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- IMPORTANT RELATIONSHIPS:
-- 1. Double-entry: SUM(debit_amount) must equal SUM(credit_amount) per journal_entry
-- 2. journal_entry_lines.account_id references chart_of_accounts.id (JOIN needed to get code/name)
-- 3. Invoice → auto-creates journal_entry with matching debit/credit lines
-- 4. Payment → auto-creates journal_entry crediting the receivable/payable
-- 5. Account codes follow TDHP:
--    1xx = Current Assets (Kasa, Banka, Alıcılar)
--    2xx = Non-current Assets
--    3xx = Short-term Liabilities (Satıcılar, Borçlar)
--    4xx = Long-term Liabilities
--    5xx = Equity
--    6xx = Revenue/Expense (Yurt İçi Satışlar, SMM)
--    7xx = Operating Expenses (Genel Yönetim, Pazarlama)
--    8xx = Extraordinary Items
--    9xx = Cost Accounts
-- 6. KDV (VAT) rates in Turkey: 1%, 10%, 20%
-- 7. To get account code/name for a journal line: JOIN chart_of_accounts ON journal_entry_lines.account_id = chart_of_accounts.id
`.trim();

/**
 * System prompt for the Virtual CFO.
 * Instructs the model to generate safe, read-only SQL.
 */
export const SYSTEM_PROMPT = `Sen bir Sanal Mali Müşavir (Virtual CFO) yapay zekasısın.
Kullanıcının doğal dil sorularını PostgreSQL sorgularına çeviriyorsun.

KURALLAR:
1. SADECE SELECT sorguları üret. INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE YASAKTIR.
2. Her sorguda company_id filtresi OLMALI: WHERE company_id = $1
3. Para birimi TRY (Türk Lirası). Formatla: TO_CHAR(amount, 'FM999,999,999.00')
4. Tarih formatı: TO_CHAR(date, 'DD.MM.YYYY')
5. Türkçe alias kullan: AS "Hesap Kodu", AS "Borç Toplamı", AS "Bakiye"
6. İlk 100 satırla sınırla: LIMIT 100
7. Yorum satırı ekleme, sadece SQL üret.
8. Tehlikeli fonksiyonlar (pg_sleep, dblink, COPY, lo_import) YASAKTIR.
9. journal_entry_lines tablosunda account_id (UUID) var, account_code YOK. Hesap kodu almak için chart_of_accounts ile JOIN yap.
10. journal_entry_lines tablosunda debit_amount ve credit_amount kullan (debit/credit DEĞİL).
11. invoices tablosunda direction kullan (invoice_type DEĞİL). kdv_total kullan (kdv_amount DEĞİL).

ŞEMA:
${SCHEMA_CONTEXT}
`;

export default SCHEMA_CONTEXT;
