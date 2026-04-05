/**
 * Generate mizan_template.xlsx — pre-styled trial balance template.
 *
 * Run: npx tsx scripts/generate-templates.ts
 *
 * Creates templates/ directory with styled .xlsx files:
 *   - mizan_template.xlsx    — Trial balance (Mizan)
 *   - bilanco_template.xlsx  — Balance sheet (Bilanço)
 *   - kdv_beyanname_template.xlsx — KDV declaration
 */
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../templates");

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1B2B4B" }, // Navy
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const CURRENCY_FMT = "#,##0.00";

async function generateMizanTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Mizan", {
    pageSetup: { orientation: "landscape", paperSize: 9 },
  });

  // Row 1: Title
  ws.mergeCells("A1:E1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "MİZAN";
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1B2B4B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // Row 2: Date placeholder
  ws.mergeCells("A2:E2");
  const dateCell = ws.getCell("A2");
  dateCell.value = "Dönem: ____________________";
  dateCell.font = { italic: true, size: 9, color: { argb: "FF666666" } };
  dateCell.alignment = { horizontal: "center" };

  // Row 3: Blank spacer
  ws.getRow(3).height = 6;

  // Row 4: Column headers — navy background
  ws.columns = [
    { key: "account_code", width: 14 },
    { key: "account_name", width: 35 },
    { key: "debit", width: 18 },
    { key: "credit", width: 18 },
    { key: "net_balance", width: 18 },
  ];

  const headerValues = ["Hesap Kodu", "Hesap Adı", "Borç", "Alacak", "Bakiye"];
  const headerRow = ws.getRow(4);
  headerValues.forEach((v, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = v;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i >= 2 ? "right" : "left" };
    if (i >= 2) cell.numFmt = CURRENCY_FMT;
  });
  headerRow.height = 22;

  // Rows 5-54: Data area (50 rows reserved)
  for (let r = 5; r <= 54; r++) {
    const row = ws.getRow(r);
    row.getCell(3).numFmt = CURRENCY_FMT;
    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = CURRENCY_FMT;
  }

  // Row 55: SUM formula row
  const sumRow = ws.getRow(55);
  sumRow.getCell(1).value = "TOPLAM";
  sumRow.getCell(1).font = { bold: true };
  sumRow.getCell(3).value = { formula: "SUM(C5:C54)" } as ExcelJS.CellFormulaValue;
  sumRow.getCell(3).numFmt = CURRENCY_FMT;
  sumRow.getCell(3).font = { bold: true };
  sumRow.getCell(4).value = { formula: "SUM(D5:D54)" } as ExcelJS.CellFormulaValue;
  sumRow.getCell(4).numFmt = CURRENCY_FMT;
  sumRow.getCell(4).font = { bold: true };
  sumRow.getCell(5).value = { formula: "SUM(E5:E54)" } as ExcelJS.CellFormulaValue;
  sumRow.getCell(5).numFmt = CURRENCY_FMT;
  sumRow.getCell(5).font = { bold: true };

  // 3 blank overflow rows
  for (let r = 56; r <= 58; r++) {
    ws.getRow(r);
  }

  // Freeze header
  ws.views = [{ state: "frozen" as const, ySplit: 4, xSplit: 0, topLeftCell: "A5", activeCell: "A5" }];

  await wb.xlsx.writeFile(path.join(TEMPLATES_DIR, "mizan_template.xlsx"));
  console.log("✅ mizan_template.xlsx created");
}

async function generateBilancoTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("Bilanço", {
    pageSetup: { orientation: "portrait", paperSize: 9 },
  });

  // Title
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = "BİLANÇO";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1B2B4B" } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = "Dönem: ____________________";
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF666666" } };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.getRow(3).height = 6;

  ws.columns = [
    { key: "type", width: 16 },
    { key: "account_code", width: 14 },
    { key: "account_name", width: 35 },
    { key: "balance", width: 18 },
  ];

  const headerValues = ["Hesap Türü", "Hesap Kodu", "Hesap Adı", "Bakiye"];
  const headerRow = ws.getRow(4);
  headerValues.forEach((v, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = v;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle" };
    if (i === 3) cell.numFmt = CURRENCY_FMT;
  });
  headerRow.height = 22;

  ws.views = [{ state: "frozen" as const, ySplit: 4, xSplit: 0, topLeftCell: "A5", activeCell: "A5" }];

  await wb.xlsx.writeFile(path.join(TEMPLATES_DIR, "bilanco_template.xlsx"));
  console.log("✅ bilanco_template.xlsx created");
}

async function generateKdvTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinOPS";
  wb.created = new Date();

  const ws = wb.addWorksheet("KDV Beyanname", {
    pageSetup: { orientation: "landscape", paperSize: 9 },
  });

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = "KDV BEYANNAME ÖZETİ";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1B2B4B" } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:E2");
  ws.getCell("A2").value = "Dönem: ____________________";
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF666666" } };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.getRow(3).height = 6;

  ws.columns = [
    { key: "rate", width: 14 },
    { key: "count", width: 14 },
    { key: "subtotal", width: 20 },
    { key: "kdv", width: 18 },
    { key: "grand", width: 20 },
  ];

  const headerValues = ["KDV Oranı (%)", "Fatura Sayısı", "Matrah", "KDV Tutarı", "Genel Toplam"];
  const headerRow = ws.getRow(4);
  headerValues.forEach((v, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = v;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: i >= 2 ? "right" : "left" };
    if (i >= 2) cell.numFmt = CURRENCY_FMT;
  });
  headerRow.height = 22;

  ws.views = [{ state: "frozen" as const, ySplit: 4, xSplit: 0, topLeftCell: "A5", activeCell: "A5" }];

  await wb.xlsx.writeFile(path.join(TEMPLATES_DIR, "kdv_beyanname_template.xlsx"));
  console.log("✅ kdv_beyanname_template.xlsx created");
}

async function main() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }

  await generateMizanTemplate();
  await generateBilancoTemplate();
  await generateKdvTemplate();
  console.log("\n✅ All templates generated in", TEMPLATES_DIR);
}

main().catch(console.error);
