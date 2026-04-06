/**
 * chart-type-detection.test.ts — Unit tests for auto-chart type detection.
 *
 * Validates the 4-rule algorithm from the Step 18 spec:
 *   Rule 1: date + one numeric → line
 *   Rule 2: category + one numeric → bar
 *   Rule 3: debit/credit numerics → grouped bar
 *   Rule 4: one row, one numeric → KPI
 *   Default: table only
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

  // Spec test: columns [date, amount] → 'line'
  it("returns 'line' for columns [date, amount]", () => {
    const rows = [
      { date: "2024-01-01", amount: 10000 },
      { date: "2024-02-01", amount: 12000 },
    ];
    expect(detectChartType(rows)).toBe("line");
  });

  // Spec test: columns [account_name, total] → 'bar'
  it("returns 'bar' for columns [account_name, total]", () => {
    const rows = [
      { account_name: "100 Kasa", total: 45000 },
      { account_name: "320 Borçlar", total: 28000 },
      { account_name: "600 Gelirler", total: 92000 },
    ];
    expect(detectChartType(rows)).toBe("bar");
  });

  // Spec test: columns [total_kdv] (single value) → 'kpi'
  it("returns 'kpi' for columns [total_kdv] single value", () => {
    const rows = [{ total_kdv: 23456.78 }];
    expect(detectChartType(rows)).toBe("kpi");
  });

  // Spec test: 15 rows, columns [id, description, amount, date] → 'table'
  it("returns 'table_only' for 15 rows with [id, description, amount, date]", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      description: `İşlem ${i + 1}`,
      amount: 1000 * (i + 1),
      date: `2024-${String(i % 12 + 1).padStart(2, "0")}-15`,
    }));
    expect(detectChartType(rows)).toBe("table_only");
  });
});
