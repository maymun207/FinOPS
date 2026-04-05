/**
 * @vitest-environment node
 *
 * Unit tests: ECharts data transformation functions.
 *
 * Tests:
 *   1. transformCashFlowData: correct labels, cashIn, cashOut, netFlow arrays
 *   2. transformCashFlowData: empty data → empty arrays
 *   3. transformCashFlowData: negative net flows preserved
 *   4. transformCashFlowData: month names use Turkish abbreviations
 *   5. transformCashFlowData: waterfall helper (transparent base) = cumulative opening
 *   6. transformCashFlowData: cashOut values are negative (downward bars)
 *   7. transformExpenseData: groups by TDHP first digit
 *   8. transformExpenseData: empty data → empty array
 *   9. transformExpenseData: uses absolute values for amounts
 */
import { describe, it, expect } from "vitest";
import { transformCashFlowData, type CashFlowData } from "@/components/charts/CashFlowWaterfall";
import { transformExpenseData, type ExpenseData } from "@/components/charts/ExpenseTreemap";

describe("CashFlow Waterfall — data transformation", () => {
  it("transforms raw data into correct labels, cashIn, cashOut, netFlow", () => {
    const data: CashFlowData[] = [
      { year: 2025, month: 1, cash_in: 10000, cash_out: 5000, net_flow: 5000 },
      { year: 2025, month: 2, cash_in: 15000, cash_out: 8000, net_flow: 7000 },
      { year: 2025, month: 3, cash_in: 12000, cash_out: 12000, net_flow: 0 },
    ];

    const result = transformCashFlowData(data);

    expect(result.labels).toEqual(["Oca 2025", "Şub 2025", "Mar 2025"]);
    expect(result.cashIn).toEqual([10000, 15000, 12000]);
    expect(result.netFlow).toEqual([5000, 7000, 0]);
  });

  it("empty data → empty arrays", () => {
    const result = transformCashFlowData([]);

    expect(result.labels).toEqual([]);
    expect(result.cashIn).toEqual([]);
    expect(result.cashOut).toEqual([]);
    expect(result.netFlow).toEqual([]);
    expect(result.helper).toEqual([]);
  });

  it("negative net flows preserved correctly", () => {
    const data: CashFlowData[] = [
      { year: 2025, month: 6, cash_in: 3000, cash_out: 8000, net_flow: -5000 },
    ];

    const result = transformCashFlowData(data);

    expect(result.netFlow[0]).toBe(-5000);
    expect(result.cashIn[0]).toBe(3000);
  });

  it("month names use Turkish abbreviations", () => {
    const data: CashFlowData[] = [
      { year: 2025, month: 7, cash_in: 0, cash_out: 0, net_flow: 0 },
      { year: 2025, month: 12, cash_in: 0, cash_out: 0, net_flow: 0 },
    ];

    const result = transformCashFlowData(data);

    expect(result.labels[0]).toBe("Tem 2025");
    expect(result.labels[1]).toBe("Ara 2025");
  });

  it("waterfall helper (transparent base) = previous cumulative total", () => {
    const data: CashFlowData[] = [
      { year: 2025, month: 1, cash_in: 10000, cash_out: 5000, net_flow: 5000 },
      { year: 2025, month: 2, cash_in: 15000, cash_out: 8000, net_flow: 7000 },
      { year: 2025, month: 3, cash_in: 12000, cash_out: 15000, net_flow: -3000 },
    ];

    const result = transformCashFlowData(data);

    // helper[0] = 0 (opening, no prior cumulative)
    // helper[1] = 5000 (after month 1 net_flow: 5000)
    // helper[2] = 12000 (after month 2 net_flow: 5000 + 7000)
    expect(result.helper).toEqual([0, 5000, 12000]);
  });

  it("cashOut values are negative for downward bars", () => {
    const data: CashFlowData[] = [
      { year: 2025, month: 1, cash_in: 10000, cash_out: 5000, net_flow: 5000 },
      { year: 2025, month: 2, cash_in: 15000, cash_out: 8000, net_flow: 7000 },
    ];

    const result = transformCashFlowData(data);

    // Values should be negative (not absolute) to render downward bars
    expect(result.cashOut[0]).toBe(-5000);
    expect(result.cashOut[1]).toBe(-8000);
    expect(result.cashOut[0]).toBeLessThan(0);
    expect(result.cashOut[1]).toBeLessThan(0);
  });
});

describe("Expense Treemap — data transformation", () => {
  it("groups expenses by TDHP first digit", () => {
    const data: ExpenseData[] = [
      { account_code: "770", account_name: "Genel Yönetim", net_amount: -5000 },
      { account_code: "760", account_name: "Pazarlama", net_amount: -3000 },
      { account_code: "620", account_name: "SMM", net_amount: -8000 },
    ];

    const result = transformExpenseData(data);

    expect(result.length).toBe(2); // Group 7 and Group 6

    const group7 = result.find((g) => g.name === "Maliyet Hesapları");
    expect(group7).toBeDefined();
    expect(group7!.children).toHaveLength(2);

    const group6 = result.find((g) => g.name === "Gelir/Gider Hesapları");
    expect(group6).toBeDefined();
    expect(group6!.children).toHaveLength(1);
  });

  it("empty data → empty array", () => {
    const result = transformExpenseData([]);
    expect(result).toEqual([]);
  });

  it("uses absolute values for negative amounts", () => {
    const data: ExpenseData[] = [
      { account_code: "770", account_name: "Gider", net_amount: -5000 },
    ];

    const result = transformExpenseData(data);
    expect(result[0]!.children[0]!.value).toBe(5000); // absolute value
  });
});
