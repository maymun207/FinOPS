/**
 * Template-based statutory report exports — ExcelJS.
 *
 * Generates Turkish financial reports with proper formatting:
 *   - exportMizanReport()       — Trial Balance (Mizan)
 *   - exportBilancoReport()     — Balance Sheet (Bilanço)
 *   - exportGelirTablosuReport()— Income Statement (Gelir Tablosu)
 *   - exportKdvBeyanReport()    — KDV Declaration (KDV Beyanname)
 *
 * Templates are built programmatically with:
 *   - TDHP account structure
 *   - Turkish number formatting (#,##0.00)
 *   - Summary/total rows
 *   - Print-ready layout (A4 landscape)
 */
import ExcelJS from "exceljs";

// ── Shared ─────────────────────────────────────────────────────────

const CURRENCY_FORMAT = "#,##0.00";

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

const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8ECF1" },
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1B2B4B" },
};

function addTitleRow(
  ws: ExcelJS.Worksheet,
  title: string,
  colSpan: number
): void {
  const row = ws.addRow([title]);
  row.font = TITLE_FONT;
  row.height = 28;
  ws.mergeCells(row.number, 1, row.number, colSpan);
  row.alignment = { horizontal: "center", vertical: "middle" };
}

function addDateRow(
  ws: ExcelJS.Worksheet,
  colSpan: number
): void {
  const dateStr = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const row = ws.addRow([`Oluşturulma: ${dateStr}`]);
  row.font = { italic: true, size: 9, color: { argb: "FF666666" } };
  ws.mergeCells(row.number, 1, row.number, colSpan);
  row.alignment = { horizontal: "center" };
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number): void {
  const row = ws.getRow(rowNum);
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function addTotalsRow(
  ws: ExcelJS.Worksheet,
  values: (string | number)[],
  _label: string
): ExcelJS.Row {
  const row = ws.addRow(values);
  row.font = { bold: true, size: 11 };
  row.fill = SUBTOTAL_FILL;
  row.height = 22;
  // Apply currency format to numeric cells
  row.eachCell((cell, colNumber) => {
    if (typeof cell.value === "number" && colNumber > 1) {
      cell.numFmt = CURRENCY_FORMAT;
    }
  });
  return row;
}

// ── Types ──────────────────────────────────────────────────────────

export interface MizanRow {
  account_code: string;
  account_name: string | null;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
  net_balance: number;
}

export interface BilancoRow {
  account_type: string;
  account_code: string;
  account_name: string | null;
  balance: number;
}

export interface GelirTablosuRow {
  account_type: string;
  account_code: string;
  account_name: string | null;
  net_amount: number;
}

export interface KdvBeyanRow {
  kdv_rate: number;
  invoice_count: number;
  total_subtotal: number;
  total_kdv: number;
  total_grand: number;
}

// ── Mizan (Trial Balance) ──────────────────────────────────────────

export async function exportMizanReport(
  rows: MizanRow[],
  companyName?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Mizan", {
    pageSetup: { orientation: "landscape", paperSize: 9 /* A4 */ },
  });

  // Title
  addTitleRow(ws, companyName ? `${companyName} — MİZAN` : "MİZAN", 9);
  addDateRow(ws, 9);
  ws.addRow([]); // blank spacer

  // Column headers (row 4)
  ws.columns = [
    { key: "account_code", width: 12 },
    { key: "account_name", width: 30 },
    { key: "opening_debit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "opening_credit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "period_debit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "period_credit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "closing_debit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "closing_credit", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "net_balance", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];

  const headerRow = ws.addRow([
    "Hesap Kodu", "Hesap Adı",
    "Açılış Borç", "Açılış Alacak",
    "Dönem Borç", "Dönem Alacak",
    "Kapanış Borç", "Kapanış Alacak",
    "Bakiye",
  ]);
  styleHeaderRow(ws, headerRow.number);

  // Data rows
  for (const r of rows) {
    const dataRow = ws.addRow([
      r.account_code,
      r.account_name ?? "",
      r.opening_debit,
      r.opening_credit,
      r.period_debit,
      r.period_credit,
      r.closing_debit,
      r.closing_credit,
      r.net_balance,
    ]);
    // Apply currency format to numeric cells
    for (let i = 3; i <= 9; i++) {
      dataRow.getCell(i).numFmt = CURRENCY_FORMAT;
    }
  }

  // Totals
  const totalOpenDebit = rows.reduce((s, r) => s + r.opening_debit, 0);
  const totalOpenCredit = rows.reduce((s, r) => s + r.opening_credit, 0);
  const totalPeriodDebit = rows.reduce((s, r) => s + r.period_debit, 0);
  const totalPeriodCredit = rows.reduce((s, r) => s + r.period_credit, 0);
  const totalCloseDebit = rows.reduce((s, r) => s + r.closing_debit, 0);
  const totalCloseCredit = rows.reduce((s, r) => s + r.closing_credit, 0);
  const totalNet = rows.reduce((s, r) => s + r.net_balance, 0);

  addTotalsRow(ws, [
    "TOPLAM", "",
    totalOpenDebit, totalOpenCredit,
    totalPeriodDebit, totalPeriodCredit,
    totalCloseDebit, totalCloseCredit,
    totalNet,
  ], "TOPLAM");

  // Freeze panes
  ws.views = [{ state: "frozen" as const, ySplit: headerRow.number, xSplit: 0, topLeftCell: `A${String(headerRow.number + 1)}`, activeCell: `A${String(headerRow.number + 1)}` }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Bilanço (Balance Sheet) ────────────────────────────────────────

export async function exportBilancoReport(
  rows: BilancoRow[],
  companyName?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Bilanço", {
    pageSetup: { orientation: "portrait", paperSize: 9 },
  });

  addTitleRow(ws, companyName ? `${companyName} — BİLANÇO` : "BİLANÇO", 4);
  addDateRow(ws, 4);
  ws.addRow([]);

  ws.columns = [
    { key: "account_type", width: 14 },
    { key: "account_code", width: 12 },
    { key: "account_name", width: 35 },
    { key: "balance", width: 18, style: { numFmt: CURRENCY_FORMAT } },
  ];

  const headerRow = ws.addRow([
    "Hesap Türü", "Hesap Kodu", "Hesap Adı", "Bakiye",
  ]);
  styleHeaderRow(ws, headerRow.number);

  // Group by account type
  const groups = new Map<string, BilancoRow[]>();
  const typeLabels: Record<string, string> = {
    asset: "AKTİF (Varlıklar)",
    liability: "PASİF (Yükümlülükler)",
    equity: "ÖZKAYNAK",
  };

  for (const r of rows) {
    if (!groups.has(r.account_type)) groups.set(r.account_type, []);
    groups.get(r.account_type)!.push(r);
  }

  for (const [type, groupRows] of groups) {
    // Section header
    const sectionRow = ws.addRow([typeLabels[type] ?? type, "", "", ""]);
    sectionRow.font = { bold: true, size: 11, color: { argb: "FF1B2B4B" } };
    sectionRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F4F8" },
    };

    for (const r of groupRows) {
      const dataRow = ws.addRow(["", r.account_code, r.account_name ?? "", r.balance]);
      dataRow.getCell(4).numFmt = CURRENCY_FORMAT;
    }

    // Section subtotal
    const subtotal = groupRows.reduce((s, r) => s + r.balance, 0);
    addTotalsRow(ws, [
      `${typeLabels[type] ?? type} Toplamı`, "", "", subtotal,
    ], "subtotal");
  }

  ws.views = [{ state: "frozen" as const, ySplit: headerRow.number, xSplit: 0, topLeftCell: `A${String(headerRow.number + 1)}`, activeCell: `A${String(headerRow.number + 1)}` }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Gelir Tablosu (Income Statement) ───────────────────────────────

export async function exportGelirTablosuReport(
  rows: GelirTablosuRow[],
  companyName?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Gelir Tablosu", {
    pageSetup: { orientation: "portrait", paperSize: 9 },
  });

  addTitleRow(ws, companyName ? `${companyName} — GELİR TABLOSU` : "GELİR TABLOSU", 4);
  addDateRow(ws, 4);
  ws.addRow([]);

  ws.columns = [
    { key: "account_type", width: 14 },
    { key: "account_code", width: 12 },
    { key: "account_name", width: 35 },
    { key: "net_amount", width: 18, style: { numFmt: CURRENCY_FORMAT } },
  ];

  const headerRow = ws.addRow(["Tür", "Hesap Kodu", "Hesap Adı", "Tutar"]);
  styleHeaderRow(ws, headerRow.number);

  // Revenue section
  const revenueRows = rows.filter((r) => r.account_type === "revenue");
  if (revenueRows.length > 0) {
    const sectionRow = ws.addRow(["GELİRLER", "", "", ""]);
    sectionRow.font = { bold: true, color: { argb: "FF1B6B3F" } };

    for (const r of revenueRows) {
      const dataRow = ws.addRow(["", r.account_code, r.account_name ?? "", r.net_amount]);
      dataRow.getCell(4).numFmt = CURRENCY_FORMAT;
    }
    const totalRevenue = revenueRows.reduce((s, r) => s + r.net_amount, 0);
    addTotalsRow(ws, ["Toplam Gelir", "", "", totalRevenue], "revenue");
  }

  // Expense section
  const expenseRows = rows.filter((r) => r.account_type === "expense");
  if (expenseRows.length > 0) {
    const sectionRow = ws.addRow(["GİDERLER", "", "", ""]);
    sectionRow.font = { bold: true, color: { argb: "FFB91C1C" } };

    for (const r of expenseRows) {
      const dataRow = ws.addRow(["", r.account_code, r.account_name ?? "", Math.abs(r.net_amount)]);
      dataRow.getCell(4).numFmt = CURRENCY_FORMAT;
    }
    const totalExpense = expenseRows.reduce((s, r) => s + Math.abs(r.net_amount), 0);
    addTotalsRow(ws, ["Toplam Gider", "", "", totalExpense], "expense");
  }

  // Net income
  const totalRevenue = revenueRows.reduce((s, r) => s + r.net_amount, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + Math.abs(r.net_amount), 0);
  ws.addRow([]);
  const netRow = ws.addRow(["NET KÂR / ZARAR", "", "", totalRevenue - totalExpense]);
  netRow.font = { bold: true, size: 12 };
  netRow.getCell(4).numFmt = CURRENCY_FORMAT;
  netRow.getCell(4).font = {
    bold: true,
    size: 12,
    color: { argb: totalRevenue - totalExpense >= 0 ? "FF1B6B3F" : "FFB91C1C" },
  };

  ws.views = [{ state: "frozen" as const, ySplit: headerRow.number, xSplit: 0, topLeftCell: `A${String(headerRow.number + 1)}`, activeCell: `A${String(headerRow.number + 1)}` }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── KDV Beyanname (VAT Declaration) ────────────────────────────────

export async function exportKdvBeyanReport(
  rows: KdvBeyanRow[],
  companyName?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("KDV Beyanname", {
    pageSetup: { orientation: "landscape", paperSize: 9 },
  });

  addTitleRow(ws, companyName ? `${companyName} — KDV BEYANNAME ÖZETİ` : "KDV BEYANNAME ÖZETİ", 5);
  addDateRow(ws, 5);
  ws.addRow([]);

  ws.columns = [
    { key: "kdv_rate", width: 12 },
    { key: "invoice_count", width: 14 },
    { key: "total_subtotal", width: 18, style: { numFmt: CURRENCY_FORMAT } },
    { key: "total_kdv", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { key: "total_grand", width: 18, style: { numFmt: CURRENCY_FORMAT } },
  ];

  const headerRow = ws.addRow([
    "KDV Oranı (%)", "Fatura Sayısı", "Matrah", "KDV Tutarı", "Genel Toplam",
  ]);
  styleHeaderRow(ws, headerRow.number);

  for (const r of rows) {
    const dataRow = ws.addRow([
      `%${String(r.kdv_rate)}`,
      r.invoice_count,
      r.total_subtotal,
      r.total_kdv,
      r.total_grand,
    ]);
    dataRow.getCell(3).numFmt = CURRENCY_FORMAT;
    dataRow.getCell(4).numFmt = CURRENCY_FORMAT;
    dataRow.getCell(5).numFmt = CURRENCY_FORMAT;
  }

  // Totals
  const totalCount = rows.reduce((s, r) => s + r.invoice_count, 0);
  const totalSub = rows.reduce((s, r) => s + r.total_subtotal, 0);
  const totalKdv = rows.reduce((s, r) => s + r.total_kdv, 0);
  const totalGrand = rows.reduce((s, r) => s + r.total_grand, 0);

  addTotalsRow(ws, ["TOPLAM", totalCount, totalSub, totalKdv, totalGrand], "TOPLAM");

  ws.views = [{ state: "frozen" as const, ySplit: headerRow.number, xSplit: 0, topLeftCell: `A${String(headerRow.number + 1)}`, activeCell: `A${String(headerRow.number + 1)}` }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
