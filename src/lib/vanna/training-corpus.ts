/**
 * Training Corpus — 50 question-SQL pairs for the Virtual CFO.
 *
 * Each pair maps a natural-language question (Turkish) to a safe,
 * company-scoped SELECT query. These are seeded into pgvector as
 * the RAG knowledge base for the Vanna inference pipeline.
 *
 * Categories (50 total):
 *   KDV queries .............. 8
 *   Receivables/Payables ..... 8
 *   Trial Balance ............ 6
 *   Cash Flow ................ 6
 *   Invoice queries .......... 8
 *   Journal Entry queries .... 6
 *   Expense analysis ......... 8
 */

export interface TrainingPair {
  question: string;
  sql: string;
  category: string;
}

export const TRAINING_CORPUS: TrainingPair[] = [
  // ──────────────────────────────────────────────────────────────
  // KDV Queries (8)
  // ──────────────────────────────────────────────────────────────
  {
    category: "kdv",
    question: "Bu dönemde toplam KDV ne kadar?",
    sql: `SELECT
  SUM(ili.kdv_rate * ili.line_total / 100) AS "Toplam KDV"
FROM invoices i
JOIN invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.company_id = $1
  AND i.fiscal_period_id = (SELECT id FROM fiscal_periods WHERE company_id = $1 AND is_closed = false ORDER BY start_date DESC LIMIT 1)
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "KDV oranlarına göre dağılım nedir?",
    sql: `SELECT
  ili.kdv_rate AS "KDV Oranı",
  COUNT(DISTINCT i.id) AS "Fatura Sayısı",
  TO_CHAR(SUM(ili.line_total), 'FM999,999,999.00') AS "Matrah",
  TO_CHAR(SUM(ili.kdv_rate * ili.line_total / 100), 'FM999,999,999.00') AS "KDV Tutarı"
FROM invoices i
JOIN invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.company_id = $1
GROUP BY ili.kdv_rate
ORDER BY ili.kdv_rate
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "Tahsil edilen ve ödenen KDV farkı nedir?",
    sql: `SELECT
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN ili.kdv_rate * ili.line_total / 100 ELSE 0 END), 'FM999,999,999.00') AS "Tahsil Edilen KDV",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'purchase' THEN ili.kdv_rate * ili.line_total / 100 ELSE 0 END), 'FM999,999,999.00') AS "Ödenen KDV",
  TO_CHAR(
    SUM(CASE WHEN i.invoice_type = 'sales' THEN ili.kdv_rate * ili.line_total / 100 ELSE 0 END)
    - SUM(CASE WHEN i.invoice_type = 'purchase' THEN ili.kdv_rate * ili.line_total / 100 ELSE 0 END),
    'FM999,999,999.00'
  ) AS "Ödenecek KDV"
FROM invoices i
JOIN invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.company_id = $1
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "Aylık KDV toplamları nedir?",
    sql: `SELECT
  TO_CHAR(i.invoice_date, 'YYYY-MM') AS "Ay",
  TO_CHAR(SUM(i.kdv_amount), 'FM999,999,999.00') AS "KDV Toplamı"
FROM invoices i
WHERE i.company_id = $1
GROUP BY TO_CHAR(i.invoice_date, 'YYYY-MM')
ORDER BY "Ay"
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "%20 KDV oranıyla kesilen faturaları göster",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Cari",
  TO_CHAR(i.invoice_date, 'DD.MM.YYYY') AS "Tarih",
  TO_CHAR(i.subtotal, 'FM999,999,999.00') AS "Matrah",
  TO_CHAR(i.kdv_amount, 'FM999,999,999.00') AS "KDV"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
JOIN invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.company_id = $1
  AND ili.kdv_rate = 20
GROUP BY i.id, i.invoice_number, c.name, i.invoice_date, i.subtotal, i.kdv_amount
ORDER BY i.invoice_date DESC
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "KDV beyanname özeti",
    sql: `SELECT
  ili.kdv_rate AS "Oran (%)",
  i.invoice_type AS "Tür",
  COUNT(*) AS "Fatura Adedi",
  TO_CHAR(SUM(ili.line_total), 'FM999,999,999.00') AS "Matrah",
  TO_CHAR(SUM(ili.kdv_rate * ili.line_total / 100), 'FM999,999,999.00') AS "KDV Tutarı",
  TO_CHAR(SUM(ili.line_total + ili.kdv_rate * ili.line_total / 100), 'FM999,999,999.00') AS "Toplam"
FROM invoices i
JOIN invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.company_id = $1
GROUP BY ili.kdv_rate, i.invoice_type
ORDER BY ili.kdv_rate, i.invoice_type
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "Satış faturalarının KDV toplamı ne kadar?",
    sql: `SELECT
  TO_CHAR(SUM(i.kdv_amount), 'FM999,999,999.00') AS "Satış KDV Toplamı"
FROM invoices i
WHERE i.company_id = $1
  AND i.invoice_type = 'sales'
LIMIT 100;`,
  },
  {
    category: "kdv",
    question: "Alış faturalarının KDV toplamı",
    sql: `SELECT
  TO_CHAR(SUM(i.kdv_amount), 'FM999,999,999.00') AS "Alış KDV Toplamı"
FROM invoices i
WHERE i.company_id = $1
  AND i.invoice_type = 'purchase'
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Receivables / Payables (8)
  // ──────────────────────────────────────────────────────────────
  {
    category: "receivables",
    question: "Vadesi geçmiş alacaklarımız ne kadar?",
    sql: `SELECT
  c.name AS "Cari",
  TO_CHAR(i.due_date, 'DD.MM.YYYY') AS "Vade Tarihi",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar",
  CURRENT_DATE - i.due_date AS "Gecikme (Gün)"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'sales'
  AND i.status IN ('sent', 'overdue')
  AND i.due_date < CURRENT_DATE
ORDER BY i.due_date
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "Alacak yaşlandırma tablosu",
    sql: `SELECT
  c.name AS "Cari",
  TO_CHAR(SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 0 AND 30 THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "0-30 Gün",
  TO_CHAR(SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "31-60 Gün",
  TO_CHAR(SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "61-90 Gün",
  TO_CHAR(SUM(CASE WHEN CURRENT_DATE - i.due_date > 90 THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "90+ Gün"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'sales'
  AND i.status IN ('sent', 'overdue')
GROUP BY c.name
ORDER BY c.name
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "Müşteri bazında alacak bakiyeleri",
    sql: `SELECT
  c.name AS "Müşteri",
  COUNT(i.id) AS "Fatura Sayısı",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Alacak"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'sales'
  AND i.status IN ('sent', 'overdue')
GROUP BY c.name
ORDER BY SUM(i.grand_total) DESC
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "Toplam alacak ve borç bakiyesi nedir?",
    sql: `SELECT
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' AND i.status IN ('sent', 'overdue') THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "Toplam Alacak",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'purchase' AND i.status IN ('sent', 'overdue') THEN i.grand_total ELSE 0 END), 'FM999,999,999.00') AS "Toplam Borç"
FROM invoices i
WHERE i.company_id = $1
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "Tedarikçilere olan borçlarımız",
    sql: `SELECT
  c.name AS "Tedarikçi",
  COUNT(i.id) AS "Fatura Sayısı",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Borç"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'purchase'
  AND i.status IN ('sent', 'overdue')
GROUP BY c.name
ORDER BY SUM(i.grand_total) DESC
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "En çok borçlu olduğumuz 5 tedarikçi",
    sql: `SELECT
  c.name AS "Tedarikçi",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Borç"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'purchase'
  AND i.status IN ('sent', 'overdue')
GROUP BY c.name
ORDER BY SUM(i.grand_total) DESC
LIMIT 5;`,
  },
  {
    category: "receivables",
    question: "Vadesi bu hafta dolan faturalar",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Cari",
  i.invoice_type AS "Tür",
  TO_CHAR(i.due_date, 'DD.MM.YYYY') AS "Vade Tarihi",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.status IN ('sent', 'overdue')
  AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY i.due_date
LIMIT 100;`,
  },
  {
    category: "receivables",
    question: "Ödenmemiş fatura sayısı ve toplam tutarı",
    sql: `SELECT
  i.invoice_type AS "Fatura Türü",
  COUNT(*) AS "Adet",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Tutar"
FROM invoices i
WHERE i.company_id = $1
  AND i.status IN ('sent', 'overdue')
GROUP BY i.invoice_type
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Trial Balance (6)
  // ──────────────────────────────────────────────────────────────
  {
    category: "trial_balance",
    question: "Mizandaki hesap bakiyelerini göster",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Borç Toplamı",
  TO_CHAR(SUM(jel.credit), 'FM999,999,999.00') AS "Alacak Toplamı",
  TO_CHAR(SUM(jel.debit) - SUM(jel.credit), 'FM999,999,999.00') AS "Bakiye"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
GROUP BY coa.code, coa.name
ORDER BY coa.code
LIMIT 100;`,
  },
  {
    category: "trial_balance",
    question: "Hesap gruplarına göre bakiye özeti",
    sql: `SELECT
  LEFT(coa.code, 1) AS "Grup",
  CASE LEFT(coa.code, 1)
    WHEN '1' THEN 'Dönen Varlıklar'
    WHEN '2' THEN 'Duran Varlıklar'
    WHEN '3' THEN 'Kısa Vadeli Borçlar'
    WHEN '4' THEN 'Uzun Vadeli Borçlar'
    WHEN '5' THEN 'Özkaynaklar'
    WHEN '6' THEN 'Gelir/Gider'
    WHEN '7' THEN 'Maliyet Hesapları'
  END AS "Grup Adı",
  TO_CHAR(SUM(jel.debit) - SUM(jel.credit), 'FM999,999,999.00') AS "Net Bakiye"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
GROUP BY LEFT(coa.code, 1)
ORDER BY LEFT(coa.code, 1)
LIMIT 100;`,
  },
  {
    category: "trial_balance",
    question: "Kasa ve banka hesaplarının bakiyesi",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit) - SUM(jel.credit), 'FM999,999,999.00') AS "Bakiye"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.code IN ('100', '101', '102')
GROUP BY coa.code, coa.name
ORDER BY coa.code
LIMIT 100;`,
  },
  {
    category: "trial_balance",
    question: "Net varlık pozisyonu nedir?",
    sql: `SELECT
  TO_CHAR(SUM(CASE WHEN LEFT(coa.code, 1) IN ('1', '2') THEN jel.debit - jel.credit ELSE 0 END), 'FM999,999,999.00') AS "Toplam Varlıklar",
  TO_CHAR(SUM(CASE WHEN LEFT(coa.code, 1) IN ('3', '4') THEN jel.credit - jel.debit ELSE 0 END), 'FM999,999,999.00') AS "Toplam Borçlar",
  TO_CHAR(
    SUM(CASE WHEN LEFT(coa.code, 1) IN ('1', '2') THEN jel.debit - jel.credit ELSE 0 END)
    - SUM(CASE WHEN LEFT(coa.code, 1) IN ('3', '4') THEN jel.credit - jel.debit ELSE 0 END),
    'FM999,999,999.00'
  ) AS "Net Varlık"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
LIMIT 100;`,
  },
  {
    category: "trial_balance",
    question: "Belirli dönem için mizan",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Borç",
  TO_CHAR(SUM(jel.credit), 'FM999,999,999.00') AS "Alacak"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND je.fiscal_period_id = (SELECT id FROM fiscal_periods WHERE company_id = $1 AND is_closed = false ORDER BY start_date DESC LIMIT 1)
GROUP BY coa.code, coa.name
HAVING SUM(jel.debit) > 0 OR SUM(jel.credit) > 0
ORDER BY coa.code
LIMIT 100;`,
  },
  {
    category: "trial_balance",
    question: "Aktif hesaplar ve bakiyeleri",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  coa.account_type AS "Hesap Türü",
  TO_CHAR(SUM(jel.debit) - SUM(jel.credit), 'FM999,999,999.00') AS "Bakiye"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.is_active = true
GROUP BY coa.code, coa.name, coa.account_type
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
ORDER BY coa.code
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Cash Flow (6)
  // ──────────────────────────────────────────────────────────────
  {
    category: "cashflow",
    question: "Aylık nakit akışı nedir?",
    sql: `SELECT
  TO_CHAR(p.payment_date, 'YYYY-MM') AS "Ay",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN p.amount ELSE 0 END), 'FM999,999,999.00') AS "Giren",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'purchase' THEN p.amount ELSE 0 END), 'FM999,999,999.00') AS "Çıkan",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN p.amount ELSE -p.amount END), 'FM999,999,999.00') AS "Net Nakit"
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE p.company_id = $1
GROUP BY TO_CHAR(p.payment_date, 'YYYY-MM')
ORDER BY "Ay"
LIMIT 100;`,
  },
  {
    category: "cashflow",
    question: "Ödeme yöntemlerine göre dağılım",
    sql: `SELECT
  p.payment_method AS "Ödeme Yöntemi",
  COUNT(*) AS "İşlem Sayısı",
  TO_CHAR(SUM(p.amount), 'FM999,999,999.00') AS "Toplam Tutar"
FROM payments p
WHERE p.company_id = $1
GROUP BY p.payment_method
ORDER BY SUM(p.amount) DESC
LIMIT 100;`,
  },
  {
    category: "cashflow",
    question: "Bu ay toplam nakit giriş ve çıkış",
    sql: `SELECT
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN p.amount ELSE 0 END), 'FM999,999,999.00') AS "Nakit Giriş",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'purchase' THEN p.amount ELSE 0 END), 'FM999,999,999.00') AS "Nakit Çıkış",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN p.amount ELSE -p.amount END), 'FM999,999,999.00') AS "Net Nakit"
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE p.company_id = $1
  AND TO_CHAR(p.payment_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
LIMIT 100;`,
  },
  {
    category: "cashflow",
    question: "Net nakit pozisyonu",
    sql: `SELECT
  TO_CHAR(SUM(jel.debit) - SUM(jel.credit), 'FM999,999,999.00') AS "Net Nakit Pozisyonu"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = $1
  AND jel.account_code IN ('100', '101', '102')
LIMIT 100;`,
  },
  {
    category: "cashflow",
    question: "Son 3 ayın nakit akış trendi",
    sql: `SELECT
  TO_CHAR(p.payment_date, 'YYYY-MM') AS "Ay",
  TO_CHAR(SUM(CASE WHEN i.invoice_type = 'sales' THEN p.amount ELSE -p.amount END), 'FM999,999,999.00') AS "Net Akış"
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE p.company_id = $1
  AND p.payment_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY TO_CHAR(p.payment_date, 'YYYY-MM')
ORDER BY "Ay"
LIMIT 100;`,
  },
  {
    category: "cashflow",
    question: "Kredi kartı ile yapılan ödemelerin toplamı",
    sql: `SELECT
  TO_CHAR(SUM(p.amount), 'FM999,999,999.00') AS "Kredi Kartı Toplam"
FROM payments p
WHERE p.company_id = $1
  AND p.payment_method = 'credit_card'
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Invoice Queries (8)
  // ──────────────────────────────────────────────────────────────
  {
    category: "invoice",
    question: "Son 10 faturayı göster",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Cari",
  i.invoice_type AS "Tür",
  TO_CHAR(i.invoice_date, 'DD.MM.YYYY') AS "Tarih",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar",
  i.status AS "Durum"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
ORDER BY i.invoice_date DESC
LIMIT 10;`,
  },
  {
    category: "invoice",
    question: "Ödenmemiş satış faturaları",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Müşteri",
  TO_CHAR(i.invoice_date, 'DD.MM.YYYY') AS "Tarih",
  TO_CHAR(i.due_date, 'DD.MM.YYYY') AS "Vade",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.invoice_type = 'sales'
  AND i.status IN ('sent', 'overdue')
ORDER BY i.due_date
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "Belirli müşterinin faturaları",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  TO_CHAR(i.invoice_date, 'DD.MM.YYYY') AS "Tarih",
  i.invoice_type AS "Tür",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar",
  i.status AS "Durum"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND c.name ILIKE '%' || $2 || '%'
ORDER BY i.invoice_date DESC
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "Fatura durumlarına göre özet",
    sql: `SELECT
  i.status AS "Durum",
  COUNT(*) AS "Adet",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Tutar"
FROM invoices i
WHERE i.company_id = $1
GROUP BY i.status
ORDER BY COUNT(*) DESC
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "100.000 TL üzerindeki faturalar",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Cari",
  TO_CHAR(i.invoice_date, 'DD.MM.YYYY') AS "Tarih",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.grand_total > 100000
ORDER BY i.grand_total DESC
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "Bu ay kesilen fatura sayısı ve toplamı",
    sql: `SELECT
  i.invoice_type AS "Tür",
  COUNT(*) AS "Adet",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam"
FROM invoices i
WHERE i.company_id = $1
  AND TO_CHAR(i.invoice_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
GROUP BY i.invoice_type
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "Vadesi geçmiş faturalar ve gecikme süreleri",
    sql: `SELECT
  i.invoice_number AS "Fatura No",
  c.name AS "Cari",
  TO_CHAR(i.due_date, 'DD.MM.YYYY') AS "Vade",
  CURRENT_DATE - i.due_date AS "Gecikme (Gün)",
  TO_CHAR(i.grand_total, 'FM999,999,999.00') AS "Tutar"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
  AND i.status IN ('sent', 'overdue')
  AND i.due_date < CURRENT_DATE
ORDER BY (CURRENT_DATE - i.due_date) DESC
LIMIT 100;`,
  },
  {
    category: "invoice",
    question: "Cari bazında fatura toplamları",
    sql: `SELECT
  c.name AS "Cari",
  c.contact_type AS "Tür",
  COUNT(i.id) AS "Fatura Sayısı",
  TO_CHAR(SUM(i.grand_total), 'FM999,999,999.00') AS "Toplam Tutar"
FROM invoices i
JOIN contacts c ON c.id = i.contact_id
WHERE i.company_id = $1
GROUP BY c.name, c.contact_type
ORDER BY SUM(i.grand_total) DESC
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Journal Entry Queries (6)
  // ──────────────────────────────────────────────────────────────
  {
    category: "journal",
    question: "Son 20 yevmiye kaydı",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  je.description AS "Açıklama",
  je.source AS "Kaynak",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Borç",
  TO_CHAR(SUM(jel.credit), 'FM999,999,999.00') AS "Alacak"
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = $1
GROUP BY je.id, je.entry_number, je.entry_date, je.description, je.source
ORDER BY je.entry_date DESC, je.entry_number DESC
LIMIT 20;`,
  },
  {
    category: "journal",
    question: "Belirli hesap kodundaki hareketler",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  jel.account_code AS "Hesap",
  jel.description AS "Açıklama",
  TO_CHAR(jel.debit, 'FM999,999,999.00') AS "Borç",
  TO_CHAR(jel.credit, 'FM999,999,999.00') AS "Alacak"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = $1
  AND jel.account_code = '100'
ORDER BY je.entry_date DESC
LIMIT 100;`,
  },
  {
    category: "journal",
    question: "Belirli tarih aralığındaki yevmiye kayıtları",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  je.description AS "Açıklama",
  je.source AS "Kaynak"
FROM journal_entries je
WHERE je.company_id = $1
  AND je.entry_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
ORDER BY je.entry_date DESC
LIMIT 100;`,
  },
  {
    category: "journal",
    question: "Manuel girilen yevmiye kayıtları",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  je.description AS "Açıklama"
FROM journal_entries je
WHERE je.company_id = $1
  AND je.source = 'manual'
ORDER BY je.entry_date DESC
LIMIT 100;`,
  },
  {
    category: "journal",
    question: "Fatura kaynaklı yevmiye kayıtları",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  je.description AS "Açıklama",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Tutar"
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = $1
  AND je.source = 'invoice'
GROUP BY je.id, je.entry_number, je.entry_date, je.description
ORDER BY je.entry_date DESC
LIMIT 100;`,
  },
  {
    category: "journal",
    question: "Açılış kayıtlarını göster",
    sql: `SELECT
  je.entry_number AS "Yevmiye No",
  TO_CHAR(je.entry_date, 'DD.MM.YYYY') AS "Tarih",
  jel.account_code AS "Hesap",
  TO_CHAR(jel.debit, 'FM999,999,999.00') AS "Borç",
  TO_CHAR(jel.credit, 'FM999,999,999.00') AS "Alacak"
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.company_id = $1
  AND je.is_opening = true
ORDER BY jel.account_code
LIMIT 100;`,
  },

  // ──────────────────────────────────────────────────────────────
  // Expense Analysis (8)
  // ──────────────────────────────────────────────────────────────
  {
    category: "expense",
    question: "TDHP grubuna göre gider dağılımı",
    sql: `SELECT
  LEFT(jel.account_code, 1) AS "Grup",
  CASE LEFT(jel.account_code, 1)
    WHEN '7' THEN 'Maliyet Hesapları'
    WHEN '6' THEN 'Gelir/Gider Hesapları'
  END AS "Grup Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Toplam Gider"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.account_type = 'expense'
GROUP BY LEFT(jel.account_code, 1)
ORDER BY SUM(jel.debit) DESC
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "Aylık gider trendi",
    sql: `SELECT
  TO_CHAR(je.entry_date, 'YYYY-MM') AS "Ay",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Toplam Gider"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.account_type = 'expense'
GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM')
ORDER BY "Ay"
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "En yüksek 10 gider kalemi",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Toplam Gider"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.account_type = 'expense'
GROUP BY coa.code, coa.name
ORDER BY SUM(jel.debit) DESC
LIMIT 10;`,
  },
  {
    category: "expense",
    question: "Genel yönetim giderleri toplamı",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Tutar"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.code LIKE '77%'
GROUP BY coa.code, coa.name
ORDER BY coa.code
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "Pazarlama ve satış giderleri",
    sql: `SELECT
  coa.code AS "Hesap Kodu",
  coa.name AS "Hesap Adı",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Tutar"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.code LIKE '76%'
GROUP BY coa.code, coa.name
ORDER BY coa.code
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "Gider/gelir oranı nedir?",
    sql: `SELECT
  TO_CHAR(SUM(CASE WHEN coa.account_type = 'expense' THEN jel.debit ELSE 0 END), 'FM999,999,999.00') AS "Toplam Gider",
  TO_CHAR(SUM(CASE WHEN coa.account_type = 'revenue' THEN jel.credit ELSE 0 END), 'FM999,999,999.00') AS "Toplam Gelir",
  ROUND(
    SUM(CASE WHEN coa.account_type = 'expense' THEN jel.debit ELSE 0 END)::numeric
    / NULLIF(SUM(CASE WHEN coa.account_type = 'revenue' THEN jel.credit ELSE 0 END), 0)::numeric * 100,
    2
  ) AS "Gider/Gelir Oranı (%)"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "Dönem bazında gider karşılaştırması",
    sql: `SELECT
  fp.name AS "Dönem",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Toplam Gider"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN fiscal_periods fp ON fp.id = je.fiscal_period_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.account_type = 'expense'
GROUP BY fp.name, fp.start_date
ORDER BY fp.start_date
LIMIT 100;`,
  },
  {
    category: "expense",
    question: "Sabit ve değişken gider ayrımı",
    sql: `SELECT
  CASE
    WHEN coa.code LIKE '77%' THEN 'Sabit Gider'
    WHEN coa.code LIKE '76%' THEN 'Değişken Gider'
    WHEN coa.code LIKE '62%' THEN 'SMM (Değişken)'
    ELSE 'Diğer'
  END AS "Gider Türü",
  TO_CHAR(SUM(jel.debit), 'FM999,999,999.00') AS "Toplam"
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.code = jel.account_code AND coa.company_id = je.company_id
WHERE je.company_id = $1
  AND coa.account_type = 'expense'
GROUP BY
  CASE
    WHEN coa.code LIKE '77%' THEN 'Sabit Gider'
    WHEN coa.code LIKE '76%' THEN 'Değişken Gider'
    WHEN coa.code LIKE '62%' THEN 'SMM (Değişken)'
    ELSE 'Diğer'
  END
ORDER BY SUM(jel.debit) DESC
LIMIT 100;`,
  },
];

export default TRAINING_CORPUS;
