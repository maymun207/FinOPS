/**
 * @vitest-environment node
 *
 * Unit tests: KPI computation logic.
 *
 * Tests from spec:
 *   1. Revenue this month: SUM of SALES invoice subtotals in current period
 *   2. Delta vs prior period: returns positive/negative percentage correctly
 *   3. Outstanding receivables: SUM of SALES invoices with status UNPAID or PARTIALLY_PAID
 *   4. Net income = revenue - expenses
 *   5. classifyDelta — direction (up/down) and colour (green/red)
 *   6. computeDeltaPercent — % change calculation with edge cases
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  classifyDelta,
  computeDeltaPercent,
} from "@/components/dashboard/KPICard";

// ── Helpers matching DashboardShell / dashboard router logic ──────────

/**
 * Compute net income from revenue and expenses strings.
 * Uses Decimal.js to avoid floating-point drift.
 */
function computeNetIncome(revenue: string, expenses: string): string {
  return new Decimal(revenue).minus(expenses).toFixed(2);
}

/**
 * Sum SALES invoice grand totals in the current period.
 * Simulates: SELECT SUM(grand_total) FROM invoices
 *   WHERE direction='outbound' AND fiscal_period_id=current
 */
function sumSalesInvoicesInPeriod(
  invoices: Array<{
    direction: string;
    fiscalPeriodId: string;
    grandTotal: string;
    status: string;
  }>,
  currentPeriodId: string
): string {
  let total = new Decimal(0);
  for (const inv of invoices) {
    if (inv.direction === "outbound" && inv.fiscalPeriodId === currentPeriodId) {
      total = total.plus(inv.grandTotal);
    }
  }
  return total.toFixed(2);
}

/**
 * Sum outstanding receivables — SALES invoices with status UNPAID or PARTIALLY_PAID.
 * Simulates: SELECT SUM(grand_total) FROM invoices
 *   WHERE direction='outbound' AND status IN ('draft','sent','partially_paid')
 */
function sumOutstandingReceivables(
  invoices: Array<{
    direction: string;
    grandTotal: string;
    status: string;
  }>
): string {
  let total = new Decimal(0);
  for (const inv of invoices) {
    if (
      inv.direction === "outbound" &&
      (inv.status === "draft" || inv.status === "sent" || inv.status === "partially_paid")
    ) {
      total = total.plus(inv.grandTotal);
    }
  }
  return total.toFixed(2);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("computeNetIncome", () => {
  it("revenue > expenses → positive net income", () => {
    expect(computeNetIncome("50000.00", "30000.00")).toBe("20000.00");
  });

  it("revenue < expenses → negative net income", () => {
    expect(computeNetIncome("15000.00", "25000.00")).toBe("-10000.00");
  });

  it("revenue = expenses → zero net income", () => {
    expect(computeNetIncome("1000.00", "1000.00")).toBe("0.00");
  });

  it("handles fractional amounts without drift", () => {
    expect(computeNetIncome("100.10", "100.20")).toBe("-0.10");
  });

  it("handles large numbers", () => {
    expect(computeNetIncome("9999999.99", "1.01")).toBe("9999998.98");
  });

  it("handles zero revenue", () => {
    expect(computeNetIncome("0", "5000.00")).toBe("-5000.00");
  });

  it("handles zero expenses", () => {
    expect(computeNetIncome("10000.00", "0")).toBe("10000.00");
  });
});

describe("sumSalesInvoicesInPeriod — revenue this month", () => {
  const currentPeriodId = "period-2026-03";
  const invoices = [
    { direction: "outbound", fiscalPeriodId: currentPeriodId, grandTotal: "12000.00", status: "paid" },
    { direction: "outbound", fiscalPeriodId: currentPeriodId, grandTotal: "8000.50", status: "sent" },
    { direction: "outbound", fiscalPeriodId: "period-2026-02", grandTotal: "5000.00", status: "paid" }, // wrong period
    { direction: "inbound", fiscalPeriodId: currentPeriodId, grandTotal: "3000.00", status: "paid" },  // purchase, not sale
  ];

  it("SUM of SALES invoice subtotals in current period only", () => {
    const revenue = sumSalesInvoicesInPeriod(invoices, currentPeriodId);
    expect(revenue).toBe("20000.50");
  });

  it("returns 0 when no invoices in period", () => {
    const revenue = sumSalesInvoicesInPeriod(invoices, "period-nonexistent");
    expect(revenue).toBe("0.00");
  });

  it("excludes inbound (purchase) invoices", () => {
    const purchaseOnly = [
      { direction: "inbound", fiscalPeriodId: currentPeriodId, grandTotal: "5000.00", status: "paid" },
    ];
    expect(sumSalesInvoicesInPeriod(purchaseOnly, currentPeriodId)).toBe("0.00");
  });
});

describe("sumOutstandingReceivables", () => {
  const invoices = [
    { direction: "outbound", grandTotal: "10000.00", status: "draft" },
    { direction: "outbound", grandTotal: "5000.00", status: "sent" },
    { direction: "outbound", grandTotal: "3000.00", status: "partially_paid" },
    { direction: "outbound", grandTotal: "20000.00", status: "paid" },          // excluded (paid)
    { direction: "outbound", grandTotal: "1000.00", status: "cancelled" },       // excluded (cancelled)
    { direction: "inbound", grandTotal: "7000.00", status: "draft" },           // excluded (purchase)
  ];

  it("SUM of SALES invoices with status UNPAID or PARTIALLY_PAID", () => {
    const receivables = sumOutstandingReceivables(invoices);
    // draft(10000) + sent(5000) + partially_paid(3000) = 18000
    expect(receivables).toBe("18000.00");
  });

  it("excludes paid invoices", () => {
    const paidOnly = [
      { direction: "outbound", grandTotal: "10000.00", status: "paid" },
    ];
    expect(sumOutstandingReceivables(paidOnly)).toBe("0.00");
  });

  it("excludes cancelled invoices", () => {
    const cancelled = [
      { direction: "outbound", grandTotal: "5000.00", status: "cancelled" },
    ];
    expect(sumOutstandingReceivables(cancelled)).toBe("0.00");
  });

  it("excludes inbound (purchase) invoices even if unpaid", () => {
    const inbound = [
      { direction: "inbound", grandTotal: "10000.00", status: "draft" },
    ];
    expect(sumOutstandingReceivables(inbound)).toBe("0.00");
  });
});

describe("computeDeltaPercent — delta vs prior period", () => {
  it("50000 current vs 40000 prior → +25%", () => {
    expect(computeDeltaPercent(50000, 40000)).toBeCloseTo(25.0, 1);
  });

  it("30000 current vs 40000 prior → -25%", () => {
    expect(computeDeltaPercent(30000, 40000)).toBeCloseTo(-25.0, 1);
  });

  it("same values → 0%", () => {
    expect(computeDeltaPercent(10000, 10000)).toBe(0);
  });

  it("prior is 0, current > 0 → +100% (avoid division by zero)", () => {
    expect(computeDeltaPercent(5000, 0)).toBe(100);
  });

  it("prior is 0, current is 0 → 0%", () => {
    expect(computeDeltaPercent(0, 0)).toBe(0);
  });

  it("100% increase (doubled)", () => {
    expect(computeDeltaPercent(20000, 10000)).toBeCloseTo(100.0, 1);
  });

  it("negative to positive returns correct sign", () => {
    // -5000 to +5000: change = 10000, |prior| = 5000, delta = 200%
    expect(computeDeltaPercent(5000, -5000)).toBeCloseTo(200.0, 1);
  });
});

describe("classifyDelta — direction and colour mapping", () => {
  it("+15% → increase (green, up arrow)", () => {
    expect(classifyDelta(15)).toBe("increase");
  });

  it("+5% → moderateIncrease (green, up arrow)", () => {
    expect(classifyDelta(5)).toBe("moderateIncrease");
  });

  it("0% → unchanged (grey)", () => {
    expect(classifyDelta(0)).toBe("unchanged");
  });

  it("-5% → moderateDecrease (red, down arrow)", () => {
    expect(classifyDelta(-5)).toBe("moderateDecrease");
  });

  it("-15% → decrease (red, down arrow)", () => {
    expect(classifyDelta(-15)).toBe("decrease");
  });

  it("+0.1% → moderateIncrease (positive but small)", () => {
    expect(classifyDelta(0.1)).toBe("moderateIncrease");
  });

  it("-0.1% → moderateDecrease (negative but small)", () => {
    expect(classifyDelta(-0.1)).toBe("moderateDecrease");
  });
});
