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
});
