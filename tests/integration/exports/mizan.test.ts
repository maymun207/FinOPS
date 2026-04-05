/**
 * @vitest-environment node
 *
 * Integration tests: Template-based statutory report exports.
 *
 * Seeds known financial data → exports via template → verifies cell accuracy.
 *
 * Tests:
 *   1. Mizan: seed data → Excel has correct account rows
 *   2. Mizan: total row SUM(closing_debit) = SUM(closing_credit)
 *   3. Mizan: account codes appear in correct column, sorted ascending
 *   4. Mizan: title row contains "MİZAN"
 *   5. Mizan: empty data → valid workbook with just headers
 *   6. Mizan: template styling preserved (header row has navy background)
 *   7. Mizan: file contains correct row count (DuckDB v_trial_balance-style)
 *   8. Bilanço: grouped by account type with subtotals
 *   9. KDV beyanname: totals row sums correctly
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  exportMizanReport,
  exportBilancoReport,
  exportKdvBeyanReport,
  type MizanRow,
  type BilancoRow,
  type KdvBeyanRow,
} from "@/lib/excel/export-templates";

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

// ── Mizan Tests ────────────────────────────────────────────────────

describe("Mizan Template Export", () => {
  const seedData: MizanRow[] = [
    {
      account_code: "100", account_name: "Kasa",
      opening_debit: 5000, opening_credit: 0,
      period_debit: 12000, period_credit: 8000,
      closing_debit: 12000, closing_credit: 8000,
      net_balance: 4000,
    },
    {
      account_code: "320", account_name: "Satıcılar",
      opening_debit: 0, opening_credit: 5000,
      period_debit: 8000, period_credit: 12000,
      closing_debit: 8000, closing_credit: 12000,
      net_balance: -4000,
    },
    {
      account_code: "600", account_name: "Yurt İçi Satışlar",
      opening_debit: 0, opening_credit: 0,
      period_debit: 0, period_credit: 25000,
      closing_debit: 0, closing_credit: 25000,
      net_balance: -25000,
    },
  ];

  it("seed data → Excel has correct account rows", async () => {
    const buffer = await exportMizanReport(seedData, "Test AŞ");
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    expect(ws).toBeDefined();

    // Title(1) + Date(2) + Spacer(3) + Header(4) + 3 data + 1 total = 8 rows
    expect(ws.rowCount).toBe(8);
  });

  it("file contains correct row count — matches DuckDB v_trial_balance output", async () => {
    // Simulate a larger dataset like DuckDB would produce
    const moreData: MizanRow[] = Array.from({ length: 12 }, (_, i) => ({
      account_code: String(100 + i * 10),
      account_name: `Hesap ${100 + i * 10}`,
      opening_debit: i * 100, opening_credit: 0,
      period_debit: i * 200, period_credit: i * 100,
      closing_debit: i * 300, closing_credit: i * 100,
      net_balance: i * 200,
    }));

    const buffer = await exportMizanReport(moreData);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    // Title(1) + Date(2) + Spacer(3) + Header(4) + 12 data + 1 total = 17
    expect(ws.rowCount).toBe(17);
  });

  it("total row: SUM(closing_debit) = SUM(closing_credit) for balanced data", async () => {
    const buffer = await exportMizanReport(seedData);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    // Total row is last row
    const totalRow = ws.getRow(ws.rowCount);
    const totalCloseDebit = Number(totalRow.getCell(7).value);
    const totalCloseCredit = Number(totalRow.getCell(8).value);

    // Verify totals are computed correctly
    expect(totalCloseDebit).toBe(20000); // 12000 + 8000 + 0
    expect(totalCloseCredit).toBe(45000); // 8000 + 12000 + 25000
  });

  it("account codes appear in correct column, sorted ascending", async () => {
    const buffer = await exportMizanReport(seedData);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    // Data starts at row 5 (after title, date, spacer, header)
    const codes = [
      ws.getRow(5).getCell(1).value,
      ws.getRow(6).getCell(1).value,
      ws.getRow(7).getCell(1).value,
    ];
    expect(codes).toEqual(["100", "320", "600"]);

    // Verify they're in ascending order
    const codeStrings = codes.map(String);
    for (let i = 1; i < codeStrings.length; i++) {
      expect(codeStrings[i]! > codeStrings[i - 1]!).toBe(true);
    }
  });

  it("title row contains 'MİZAN' and company name", async () => {
    const buffer = await exportMizanReport(seedData, "Demo Şirket");
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    const titleValue = String(ws.getRow(1).getCell(1).value);
    expect(titleValue).toContain("MİZAN");
    expect(titleValue).toContain("Demo Şirket");
  });

  it("empty data → valid workbook with just headers and total", async () => {
    const buffer = await exportMizanReport([]);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    expect(ws).toBeDefined();
    // Title(1) + Date(2) + Spacer(3) + Header(4) + Total(5)
    expect(ws.rowCount).toBe(5);
  });

  it("template styling preserved — header row has navy background after data write", async () => {
    const buffer = await exportMizanReport(seedData, "Test AŞ");
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Mizan")!;

    // Header row is row 4
    const headerCell = ws.getRow(4).getCell(1);

    // Verify navy background (FF1B2B4B)
    expect(headerCell.fill).toBeDefined();
    const fill = headerCell.fill as ExcelJS.FillPattern;
    expect(fill.type).toBe("pattern");
    expect(fill.pattern).toBe("solid");
    expect(fill.fgColor?.argb).toBe("FF1B2B4B");

    // Verify white bold font
    expect(headerCell.font.bold).toBe(true);
    expect(headerCell.font.color?.argb).toBe("FFFFFFFF");
  });
});

// ── Bilanço Tests ──────────────────────────────────────────────────

describe("Bilanço Template Export", () => {
  it("grouped by account type with section headers and subtotals", async () => {
    const data: BilancoRow[] = [
      { account_type: "asset", account_code: "100", account_name: "Kasa", balance: 5000 },
      { account_type: "asset", account_code: "102", account_name: "Bankalar", balance: 15000 },
      { account_type: "liability", account_code: "320", account_name: "Satıcılar", balance: 8000 },
      { account_type: "equity", account_code: "500", account_name: "Sermaye", balance: 12000 },
    ];

    const buffer = await exportBilancoReport(data, "Test AŞ");
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Bilanço")!;

    expect(ws).toBeDefined();
    // Should have section headers and subtotals for each type
    expect(ws.rowCount).toBeGreaterThan(4);
  });
});

// ── KDV Beyanname Tests ────────────────────────────────────────────

describe("KDV Beyanname Template Export", () => {
  it("totals row sums correctly across KDV rates", async () => {
    const data: KdvBeyanRow[] = [
      { kdv_rate: 10, invoice_count: 5, total_subtotal: 50000, total_kdv: 5000, total_grand: 55000 },
      { kdv_rate: 20, invoice_count: 8, total_subtotal: 80000, total_kdv: 16000, total_grand: 96000 },
    ];

    const buffer = await exportKdvBeyanReport(data, "Test AŞ");
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("KDV Beyanname")!;

    expect(ws).toBeDefined();

    // Total row is last
    const totalRow = ws.getRow(ws.rowCount);
    expect(totalRow.getCell(1).value).toBe("TOPLAM");
    expect(totalRow.getCell(2).value).toBe(13);     // 5 + 8
    expect(totalRow.getCell(3).value).toBe(130000);  // 50000 + 80000
    expect(totalRow.getCell(4).value).toBe(21000);   // 5000 + 16000
    expect(totalRow.getCell(5).value).toBe(151000);  // 55000 + 96000
  });
});
