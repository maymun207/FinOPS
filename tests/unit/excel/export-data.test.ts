/**
 * @vitest-environment node
 *
 * Unit tests: ExcelJS data export utilities.
 *
 * Tests:
 *   1. Transaction export → returned buffer is valid .xlsx (magic bytes: 50 4B 03 04)
 *   2. Transaction export: 5 rows → workbook has 7 rows (header + 5 data + 1 total)
 *   3. Header row has Turkish column names
 *   4. Empty rows → valid workbook with just header
 *   5. Totals row sums debit and credit correctly
 *   6. Header has bold white font
 *   7. Debit column cell format is '#,##0.00'
 *   8. First row is frozen (ws.views[0].state === 'frozen')
 *   9. Monetary values are stored as numbers, not strings (ExcelJS.ValueType.Number)
 *  10. Contact export: 3 contacts → correct headers in Turkish
 *  11. Invoice export: totals row sums correctly
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  exportTransactions,
  exportContacts,
  exportInvoices,
  type TransactionRow,
  type ContactRow,
  type InvoiceRow,
} from "@/lib/excel/export-data";

// ── Helpers ────────────────────────────────────────────────────────

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Excel Data Export — Transactions", () => {
  it("returned buffer is valid .xlsx (magic bytes: 50 4B 03 04)", async () => {
    const rows: TransactionRow[] = [
      { date: "2025-01-01", account_code: "100", description: "Test", debit: 1000, credit: 0 },
    ];

    const buffer = await exportTransactions(rows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // ZIP / XLSX magic bytes: PK\x03\x04 → 0x50 0x4B 0x03 0x04
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });

  it("5 rows → workbook has 7 rows (header + 5 data + 1 total)", async () => {
    const rows: TransactionRow[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      account_code: `10${i}`,
      account_name: `Hesap ${i}`,
      description: `İşlem ${i}`,
      debit: (i + 1) * 1000,
      credit: 0,
    }));

    const buffer = await exportTransactions(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler");
    expect(ws).toBeDefined();

    // Header(1) + 5 data + 1 total = 7 rows
    expect(ws!.rowCount).toBe(7);
  });

  it("header row has Turkish column names", async () => {
    const buffer = await exportTransactions([]);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    const headerRow = ws.getRow(1);
    expect(headerRow.getCell(1).value).toBe("Tarih");
    expect(headerRow.getCell(2).value).toBe("Hesap Kodu");
    expect(headerRow.getCell(3).value).toBe("Hesap Adı");
    expect(headerRow.getCell(4).value).toBe("Açıklama");
    expect(headerRow.getCell(5).value).toBe("Borç");
    expect(headerRow.getCell(6).value).toBe("Alacak");
  });

  it("empty rows → valid workbook with just header", async () => {
    const buffer = await exportTransactions([]);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    // Only header row (no total row for empty data)
    expect(ws.rowCount).toBe(1);
  });

  it("totals row sums debit and credit correctly", async () => {
    const rows: TransactionRow[] = [
      { date: "2025-01-01", account_code: "100", description: "A", debit: 5000, credit: 0 },
      { date: "2025-01-02", account_code: "320", description: "B", debit: 0, credit: 3000 },
      { date: "2025-01-03", account_code: "100", description: "C", debit: 2000, credit: 0 },
    ];

    const buffer = await exportTransactions(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    const totalRow = ws.getRow(ws.rowCount);
    expect(totalRow.getCell(4).value).toBe("TOPLAM");
    expect(totalRow.getCell(5).value).toBe(7000); // 5000 + 2000
    expect(totalRow.getCell(6).value).toBe(3000);
  });

  it("header has bold white font", async () => {
    const buffer = await exportTransactions([]);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    const headerFont = ws.getRow(1).getCell(1).font;
    expect(headerFont.bold).toBe(true);
    expect(headerFont.color?.argb).toBe("FFFFFFFF");
  });

  it("debit column cell format is '#,##0.00'", async () => {
    const rows: TransactionRow[] = [
      { date: "2025-01-01", account_code: "100", description: "X", debit: 1234.56, credit: 0 },
    ];

    const buffer = await exportTransactions(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    // Verify via column style (debit is column 5)
    const col5 = ws.getColumn(5);
    expect(col5.style?.numFmt).toBe("#,##0.00");
  });

  it("first row is frozen (ws.views[0].state === 'frozen')", async () => {
    const buffer = await exportTransactions([]);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    expect(ws.views).toBeDefined();
    expect(ws.views.length).toBeGreaterThan(0);
    expect(ws.views[0]!.state).toBe("frozen");
  });

  it("monetary values are stored as numbers, not strings (ValueType.Number)", async () => {
    const rows: TransactionRow[] = [
      { date: "2025-01-01", account_code: "100", description: "Test", debit: 1500.50, credit: 0 },
      { date: "2025-01-02", account_code: "320", description: "Test 2", debit: 0, credit: 2500.75 },
    ];

    const buffer = await exportTransactions(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Hareketler")!;

    // Row 2 is first data row (row 1 is header)
    const debitCell = ws.getCell("E2");
    const creditCell = ws.getCell("F3");

    // ExcelJS ValueType.Number === 2
    expect(debitCell.type).toBe(ExcelJS.ValueType.Number);
    expect(creditCell.type).toBe(ExcelJS.ValueType.Number);

    // Verify actual numeric values
    expect(debitCell.value).toBe(1500.50);
    expect(creditCell.value).toBe(2500.75);
  });
});

describe("Excel Data Export — Contacts", () => {
  it("3 contacts → correct row count and Turkish headers", async () => {
    const rows: ContactRow[] = [
      { name: "ABC Ltd", type: "customer", tax_id: "1234567890", email: "abc@test.com", phone: "5551234567", address: "İstanbul" },
      { name: "XYZ AŞ", type: "vendor", tax_id: "9876543210", email: null, phone: null, address: null },
      { name: "Deneme", type: "both", tax_id: "1111111111", email: "d@test.com", phone: null, address: "Ankara" },
    ];

    const buffer = await exportContacts(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Cariler")!;

    // Header + 3 data rows
    expect(ws.rowCount).toBe(4);
    expect(ws.getRow(1).getCell(1).value).toBe("Cari Adı");
    expect(ws.getRow(1).getCell(2).value).toBe("Türü");
    expect(ws.getRow(1).getCell(3).value).toBe("VKN");
  });
});

describe("Excel Data Export — Invoices", () => {
  it("invoice totals row sums monetary columns correctly", async () => {
    const rows: InvoiceRow[] = [
      { invoice_number: "FAT-001", invoice_date: "2025-01-15", due_date: "2025-02-15", direction: "outbound", contact_name: "ABC", status: "ISSUED", subtotal: 10000, kdv_total: 1800, grand_total: 11800 },
      { invoice_number: "FAT-002", invoice_date: "2025-01-20", due_date: null, direction: "inbound", contact_name: "XYZ", status: "PAID", subtotal: 5000, kdv_total: 900, grand_total: 5900 },
    ];

    const buffer = await exportInvoices(rows);
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Faturalar")!;

    // Header + 2 data + 1 total = 4
    expect(ws.rowCount).toBe(4);

    const totalRow = ws.getRow(4);
    expect(totalRow.getCell(6).value).toBe("TOPLAM");
    expect(totalRow.getCell(7).value).toBe(15000); // 10000 + 5000
    expect(totalRow.getCell(8).value).toBe(2700);  // 1800 + 900
    expect(totalRow.getCell(9).value).toBe(17700); // 11800 + 5900
  });
});
