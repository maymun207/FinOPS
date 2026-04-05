/**
 * Excel data export utilities — ExcelJS.
 *
 * Exports financial data as styled .xlsx workbooks:
 *   - exportTransactions()  — Journal entry lines ("Hareketler")
 *   - exportContacts()      — Contact list ("Cariler")
 *   - exportInvoices()      — Invoice list ("Faturalar")
 *
 * Styling:
 *   - Frozen first row
 *   - Dark header (#1B2B4B) with white bold text
 *   - Turkish number format: #,##0.00
 *   - Auto-width columns
 */
import ExcelJS from "exceljs";

// ── Shared types ───────────────────────────────────────────────────

export interface TransactionRow {
  date: string;
  account_code: string;
  account_name?: string;
  description: string;
  debit: number;
  credit: number;
}

export interface ContactRow {
  name: string;
  type: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface InvoiceRow {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  direction: string;
  contact_name: string | null;
  status: string;
  subtotal: number;
  kdv_total: number;
  grand_total: number;
}

// ── Shared styling ─────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1B2B4B" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const CURRENCY_FORMAT = "#,##0.00";

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function freezeFirstRow(ws: ExcelJS.Worksheet): void {
  ws.views = [{ state: "frozen" as const, ySplit: 1, xSplit: 0, topLeftCell: "A2", activeCell: "A2" }];
}

// ── Transaction Export ─────────────────────────────────────────────

export async function exportTransactions(
  rows: TransactionRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Hareketler");

  ws.columns = [
    { header: "Tarih", key: "date", width: 14 },
    { header: "Hesap Kodu", key: "account_code", width: 12 },
    { header: "Hesap Adı", key: "account_name", width: 30 },
    { header: "Açıklama", key: "description", width: 40 },
    {
      header: "Borç",
      key: "debit",
      width: 16,
      style: { numFmt: CURRENCY_FORMAT },
    },
    {
      header: "Alacak",
      key: "credit",
      width: 16,
      style: { numFmt: CURRENCY_FORMAT },
    },
  ];

  freezeFirstRow(ws);
  styleHeaderRow(ws);

  rows.forEach((r) => ws.addRow(r));

  // Add totals row
  if (rows.length > 0) {
    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
    const totalsRow = ws.addRow({
      date: "",
      account_code: "",
      account_name: "",
      description: "TOPLAM",
      debit: totalDebit,
      credit: totalCredit,
    });
    totalsRow.font = { bold: true };
    totalsRow.getCell("debit").numFmt = CURRENCY_FORMAT;
    totalsRow.getCell("credit").numFmt = CURRENCY_FORMAT;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Contact Export ─────────────────────────────────────────────────

export async function exportContacts(
  rows: ContactRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Cariler");

  ws.columns = [
    { header: "Cari Adı", key: "name", width: 30 },
    { header: "Türü", key: "type", width: 12 },
    { header: "VKN", key: "tax_id", width: 14 },
    { header: "E-posta", key: "email", width: 25 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Adres", key: "address", width: 40 },
  ];

  freezeFirstRow(ws);
  styleHeaderRow(ws);

  rows.forEach((r) => ws.addRow(r));

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Invoice Export ─────────────────────────────────────────────────

export async function exportInvoices(
  rows: InvoiceRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Faturalar");

  ws.columns = [
    { header: "Fatura No", key: "invoice_number", width: 16 },
    { header: "Fatura Tarihi", key: "invoice_date", width: 14 },
    { header: "Vade Tarihi", key: "due_date", width: 14 },
    { header: "Yön", key: "direction", width: 10 },
    { header: "Cari", key: "contact_name", width: 25 },
    { header: "Durum", key: "status", width: 12 },
    {
      header: "Ara Toplam",
      key: "subtotal",
      width: 16,
      style: { numFmt: CURRENCY_FORMAT },
    },
    {
      header: "KDV",
      key: "kdv_total",
      width: 14,
      style: { numFmt: CURRENCY_FORMAT },
    },
    {
      header: "Genel Toplam",
      key: "grand_total",
      width: 16,
      style: { numFmt: CURRENCY_FORMAT },
    },
  ];

  freezeFirstRow(ws);
  styleHeaderRow(ws);

  rows.forEach((r) => ws.addRow(r));

  // Add totals row
  if (rows.length > 0) {
    const totalSub = rows.reduce((sum, r) => sum + r.subtotal, 0);
    const totalKdv = rows.reduce((sum, r) => sum + r.kdv_total, 0);
    const totalGrand = rows.reduce((sum, r) => sum + r.grand_total, 0);
    const totalsRow = ws.addRow({
      invoice_number: "",
      invoice_date: "",
      due_date: "",
      direction: "",
      contact_name: "",
      status: "TOPLAM",
      subtotal: totalSub,
      kdv_total: totalKdv,
      grand_total: totalGrand,
    });
    totalsRow.font = { bold: true };
    totalsRow.getCell("subtotal").numFmt = CURRENCY_FORMAT;
    totalsRow.getCell("kdv_total").numFmt = CURRENCY_FORMAT;
    totalsRow.getCell("grand_total").numFmt = CURRENCY_FORMAT;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
