/**
 * chart-type-detection.test.ts — Unit tests for auto-chart type detection.
 *
 * Validates the 5 rules from the Step 18 spec:
 *   1. date + numeric → line
 *   2. category + numeric → bar
 *   3. debit/credit numerics → grouped bar
 *   4. one row, one numeric → KPI
 *   5. >10 rows, no date → table only
 */
import { describe, it, expect } from "vitest";
import { detectChartType, inferColumns } from "@/lib/cfo/chart-detection";

describe("inferColumns", () => {
  it("detects numeric columns", () => {
    const cols = inferColumns([{ amount: 1500, name: "Test" }]);
    expect(cols).toEqual([
      { name: "amount", type: "numeric" },
      { name: "name", type: "string" },
    ]);
  });

  it("detects date columns by name pattern", () => {
    const cols = inferColumns([{ month: 3, toplam: 1000 }]);
    expect(cols).toEqual([
      { name: "month", type: "date" },
      { name: "toplam", type: "numeric" },
    ]);
  });

  it("returns empty for no rows", () => {
    expect(inferColumns([])).toEqual([]);
  });
});

describe("detectChartType", () => {
  it("returns 'kpi' for one row with one numeric", () => {
    const rows = [{ "Toplam KDV": 23456.78 }];
    expect(detectChartType(rows)).toBe("kpi");
  });

  it("returns 'line' for date/period + numeric (trend)", () => {
    const rows = [
      { month: 1, toplam: 10000 },
      { month: 2, toplam: 12000 },
      { month: 3, toplam: 11000 },
    ];
    expect(detectChartType(rows)).toBe("line");
  });

  it("returns 'bar' for category + numeric", () => {
    const rows = [
      { kategori: "Satış", toplam: 5000 },
      { kategori: "Hizmet", toplam: 3000 },
      { kategori: "Kira", toplam: 2000 },
    ];
    expect(detectChartType(rows)).toBe("bar");
  });

  it("returns 'grouped_bar' for debit/credit columns", () => {
    const rows = [
      { hesap: "100", debit: 5000, credit: 3000 },
      { hesap: "320", debit: 2000, credit: 4000 },
    ];
    expect(detectChartType(rows)).toBe("grouped_bar");
  });

  it("returns 'table_only' for >10 rows without date", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      hesap_kodu: `${100 + i}`,
      bakiye: 1000 * (i + 1),
    }));
    expect(detectChartType(rows)).toBe("table_only");
  });

  it("returns 'table_only' for empty rows", () => {
    expect(detectChartType([])).toBe("table_only");
  });

  it("returns 'line' for date column with Turkish name", () => {
    const rows = [
      { dönem: "2024-01", gelir: 10000 },
      { dönem: "2024-02", gelir: 12000 },
    ];
    expect(detectChartType(rows)).toBe("line");
  });

  it("returns 'grouped_bar' for Turkish debit/credit names", () => {
    const rows = [
      { hesap: "100", borç: 5000, alacak: 3000 },
      { hesap: "320", borç: 2000, alacak: 4000 },
    ];
    expect(detectChartType(rows)).toBe("grouped_bar");
  });
});
