/**
 * Schema Context — FinOPS database schema description for the Virtual CFO system prompt.
 *
 * Provides a compact, human-readable DDL summary of all tables, columns,
 * and relationships to feed into the LLM as context for SQL generation.
 *
 * This is NOT raw DDL — it's a curated description optimized for token
 * efficiency while preserving the semantic information the model needs.
 */

export const SCHEMA_CONTEXT = `
-- FinOPS Database Schema (Supabase/PostgreSQL)
-- Multi-tenant financial accounting system for Turkish businesses
-- All monetary values are NUMERIC(15,2) in TRY (Turkish Lira)
-- Multi-tenant isolation via company_id FK on all tables

-- companies: each Clerk organization maps to one company
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tax_number VARCHAR(11),
  tax_office TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- fiscal_periods: accounting periods (typically monthly)
CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,           -- e.g. "Ocak 2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ
);

-- chart_of_accounts: TDHP (Tekdüzen Hesap Planı) standard accounts
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  code VARCHAR(10) NOT NULL,    -- e.g. "100", "320", "600"
  name TEXT NOT NULL,            -- e.g. "Kasa", "Satıcılar", "Yurt İçi Satışlar"
  account_type VARCHAR(20),     -- asset, liability, equity, revenue, expense
  normal_balance VARCHAR(10),   -- debit or credit
  is_active BOOLEAN DEFAULT true,
  parent_code VARCHAR(10)       -- hierarchical parent
);

-- contacts: müşteri (customer) / tedarikçi (supplier) records
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  tax_number VARCHAR(11),
  contact_type VARCHAR(20),     -- customer, supplier, both
  email TEXT,
  phone TEXT
);

-- invoices: sales & purchase invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  invoice_number TEXT NOT NULL,
  invoice_type VARCHAR(20),     -- sales, purchase
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(15,2) DEFAULT 0,
  kdv_amount NUMERIC(15,2) DEFAULT 0,     -- VAT amount
  grand_total NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',      -- draft, sent, paid, overdue, cancelled
  created_at TIMESTAMPTZ DEFAULT now()
);

-- invoice_line_items: individual items per invoice
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  kdv_rate NUMERIC(5,2) DEFAULT 20,        -- VAT rate (1, 10, 20)
  line_total NUMERIC(15,2),
  account_code VARCHAR(10)
);

-- journal_entries: yevmiye defteri header
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  entry_number INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  source VARCHAR(20),           -- manual, invoice, payment, import
  is_opening BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- journal_entry_lines: individual debit/credit lines (double-entry)
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(10) NOT NULL,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  contact_id UUID REFERENCES contacts(id)
);

-- payments: ödeme kayıtları
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  contact_id UUID REFERENCES contacts(id),
  amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(20),    -- cash, bank_transfer, check, credit_card
  journal_entry_id UUID REFERENCES journal_entries(id)
);

-- IMPORTANT RELATIONSHIPS:
-- 1. Double-entry: SUM(debit) must equal SUM(credit) per journal_entry
-- 2. Invoice → auto-creates journal_entry with matching debit/credit lines
-- 3. Payment → auto-creates journal_entry crediting the receivable/payable
-- 4. Account codes follow TDHP:
--    1xx = Current Assets (Kasa, Banka, Alıcılar)
--    2xx = Non-current Assets
--    3xx = Short-term Liabilities (Satıcılar, Borçlar)
--    4xx = Long-term Liabilities
--    5xx = Equity
--    6xx = Revenue/Expense (Yurt İçi Satışlar, SMM)
--    7xx = Operating Expenses (Genel Yönetim, Pazarlama)
--    8xx = Extraordinary Items
--    9xx = Cost Accounts
-- 5. KDV (VAT) rates in Turkey: 1%, 10%, 20%
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

ŞEMA:
${SCHEMA_CONTEXT}
`;

export default SCHEMA_CONTEXT;
