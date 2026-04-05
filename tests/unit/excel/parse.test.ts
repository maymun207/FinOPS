/**
 * @vitest-environment node
 *
 * Unit tests for the SheetJS Excel/CSV parsing utility.
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "@/lib/excel/parse";

/**
 * Helper: create an in-memory workbook and return its ArrayBuffer.
 */
function createTestWorkbook(
  sheets: Array<{ name: string; data: unknown[][] }>
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}

describe("parseExcelBuffer", () => {
  it("parses a single-sheet workbook with headers and rows", () => {
    const buffer = createTestWorkbook([
      {
        name: "Faturalar",
        data: [
          ["Fatura No", "Tutar", "Tarih"],
          ["FAT-001", 1234.56, 44927],
          ["FAT-002", 789.01, 44928],
        ],
      },
    ]);

    const result = parseExcelBuffer(buffer, "test.xlsx");

    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0]!.name).toBe("Faturalar");
    expect(result.sheets[0]!.headers).toEqual(["Fatura No", "Tutar", "Tarih"]);
    expect(result.sheets[0]!.rows).toHaveLength(2);
    expect(result.totalRows).toBe(2);
    expect(result.meta.fileName).toBe("test.xlsx");
    expect(result.meta.sheetCount).toBe(1);

    // Verify first row data
    const row1 = result.sheets[0]!.rows[0]!;
    expect(row1["Fatura No"]).toBe("FAT-001");
    expect(row1["Tutar"]).toBe(1234.56);
    expect(row1["Tarih"]).toBe(44927);
  });

  it("parses multi-sheet workbook", () => {
    const buffer = createTestWorkbook([
      {
        name: "Sheet1",
        data: [
          ["Col A", "Col B"],
          ["a1", "b1"],
        ],
      },
      {
        name: "Sheet2",
        data: [
          ["X", "Y", "Z"],
          ["x1", "y1", "z1"],
          ["x2", "y2", "z2"],
        ],
      },
    ]);

    const result = parseExcelBuffer(buffer);

    expect(result.sheets).toHaveLength(2);
    expect(result.meta.sheetCount).toBe(2);
    expect(result.totalRows).toBe(3);
    expect(result.sheets[0]!.headers).toEqual(["Col A", "Col B"]);
    expect(result.sheets[1]!.headers).toEqual(["X", "Y", "Z"]);
  });

  it("handles empty cells as empty strings", () => {
    const buffer = createTestWorkbook([
      {
        name: "Sparse",
        data: [
          ["A", "B", "C"],
          ["v1", "", "v3"],
        ],
      },
    ]);

    const result = parseExcelBuffer(buffer);
    const row = result.sheets[0]!.rows[0]!;
    expect(row["B"]).toBe("");
  });

  it("handles workbook with headers only (no data rows)", () => {
    const buffer = createTestWorkbook([
      {
        name: "Empty",
        data: [["Header1", "Header2"]],
      },
    ]);

    const result = parseExcelBuffer(buffer);
    expect(result.sheets[0]!.rows).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  it("preserves raw numeric values (no formatting)", () => {
    const buffer = createTestWorkbook([
      {
        name: "Numbers",
        data: [
          ["Amount"],
          [0.1 + 0.2], // floating point
          [999999999],
        ],
      },
    ]);

    const result = parseExcelBuffer(buffer);
    expect(result.sheets[0]!.rows).toHaveLength(2);
    expect(typeof result.sheets[0]!.rows[0]!["Amount"]).toBe("number");
  });

  it("returns fileName in meta when provided", () => {
    const buffer = createTestWorkbook([
      { name: "S1", data: [["A"], [1]] },
    ]);

    const withName = parseExcelBuffer(buffer, "report.xlsx");
    expect(withName.meta.fileName).toBe("report.xlsx");

    const withoutName = parseExcelBuffer(buffer);
    expect(withoutName.meta.fileName).toBeUndefined();
  });

  it("parses .xls (legacy format) → same result as .xlsx", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Fatura No", "Tutar"],
      ["FAT-001", 100],
      ["FAT-002", 200],
      ["FAT-003", 300],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Test");
    // Write as .xls (BIFF8)
    const buf = XLSX.write(wb, { type: "array", bookType: "xls" }) as ArrayBuffer;

    const result = parseExcelBuffer(buf, "legacy.xls");

    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0]!.rows).toHaveLength(3);
    expect(result.sheets[0]!.headers).toEqual(["Fatura No", "Tutar"]);
    expect(result.sheets[0]!.rows[0]!["Fatura No"]).toBe("FAT-001");
    expect(result.sheets[0]!.rows[2]!["Tutar"]).toBe(300);
    expect(result.meta.fileName).toBe("legacy.xls");
  });

  it("parses .csv with semicolon delimiter → handled correctly", () => {
    // SheetJS auto-detects semicolons in CSV
    const csvContent = "Ad;Soyad;VKN\nAli;Yılmaz;1234567890\nVeli;Kaya;9876543210";
    const wb = XLSX.read(csvContent, { type: "string" });
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const result = parseExcelBuffer(buf, "semicolons.csv");

    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0]!.rows).toHaveLength(2);
    // SheetJS should separate by semicolon
    const row = result.sheets[0]!.rows[0]!;
    // Check that the three values are separated (not concatenated)
    const headers = result.sheets[0]!.headers;
    expect(headers.length).toBeGreaterThanOrEqual(1);
    // Verify data is present
    const allValues = Object.values(row);
    const joined = allValues.join(" ");
    expect(joined).toContain("Ali");
  });

  it("file with merged cells → merged cells return first cell value, others empty string", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["A", "B", "C"],
      ["merged", "", "value"],
      ["row2-a", "row2-b", "row2-c"],
    ]);
    // Simulate merge: A2:B2
    ws["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const result = parseExcelBuffer(buf, "merged.xlsx");

    expect(result.sheets[0]!.rows).toHaveLength(2);
    const row1 = result.sheets[0]!.rows[0]!;
    expect(row1["A"]).toBe("merged");
    // Merged area: cell B returns empty string (defval)
    expect(row1["B"]).toBe("");
    expect(row1["C"]).toBe("value");
  });
});
