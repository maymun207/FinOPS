/**
 * @vitest-environment node
 *
 * Unit tests: KDV calculation utilities (decimal.js based)
 * Pure function tests — no database required.
 *
 * All KDV functions return STRINGS (matching Postgres decimal column types).
 * Tests verify string equality for exact precision matching.
 */
import { describe, it, expect } from "vitest";
import {
  calculateKdv,
  calculateTotal,
  calculateLineItem,
  extractSubtotalFromTotal,
  roundTo,
  KDV_RATES,
} from "@/lib/finance/kdv";

describe("roundTo", () => {
  it("rounds to 2 decimal places by default", () => {
    expect(roundTo(1.005)).toBe("1.01");
    expect(roundTo(1.004)).toBe("1.00");
    expect(roundTo(99.995)).toBe("100.00");
  });

  it("rounds to custom decimal places", () => {
    expect(roundTo(1.23456, 4)).toBe("1.2346");
    expect(roundTo(1.23456, 0)).toBe("1");
  });

  it("handles string inputs (Drizzle decimal column return type)", () => {
    expect(roundTo("1.005")).toBe("1.01");
    expect(roundTo("99.995")).toBe("100.00");
    expect(roundTo("123456789012.99")).toBe("123456789012.99");
  });

  it("handles large numbers without floating-point drift", () => {
    expect(roundTo("9999999999999.99")).toBe("9999999999999.99");
    expect(roundTo("9999999999999.995")).toBe("10000000000000.00");
  });
});

describe("calculateKdv", () => {
  it("calculates 20% KDV (standard rate)", () => {
    expect(calculateKdv(1000, KDV_RATES.STANDARD)).toBe("200.00");
    expect(calculateKdv("149.99", KDV_RATES.STANDARD)).toBe("30.00");
  });

  it("calculates 10% KDV (reduced rate)", () => {
    expect(calculateKdv(1000, KDV_RATES.REDUCED)).toBe("100.00");
    expect(calculateKdv("333.33", KDV_RATES.REDUCED)).toBe("33.33");
  });

  it("calculates 1% KDV (super-reduced rate)", () => {
    expect(calculateKdv(1000, KDV_RATES.SUPER_REDUCED)).toBe("10.00");
    expect(calculateKdv(250, KDV_RATES.SUPER_REDUCED)).toBe("2.50");
  });

  it("returns 0.00 for exempt rate", () => {
    expect(calculateKdv(1000, KDV_RATES.EXEMPT)).toBe("0.00");
  });

  it("handles fractional subtotals with proper rounding", () => {
    // 123.45 × 20% = 24.69
    expect(calculateKdv("123.45", 20)).toBe("24.69");
    // 99.99 × 10% = 9.999 → 10.00
    expect(calculateKdv("99.99", 10)).toBe("10.00");
  });

  it("handles string inputs from Drizzle decimal columns", () => {
    expect(calculateKdv("1000.00", "20")).toBe("200.00");
    expect(calculateKdv("500.50", "10")).toBe("50.05");
  });
});

describe("calculateTotal", () => {
  it("returns subtotal + KDV", () => {
    expect(calculateTotal(1000, 20)).toBe("1200.00");
    expect(calculateTotal(500, 10)).toBe("550.00");
    expect(calculateTotal(100, 1)).toBe("101.00");
  });

  it("returns subtotal unchanged for exempt", () => {
    expect(calculateTotal(1000, 0)).toBe("1000.00");
  });
});

describe("spec validation — exact values from requirements", () => {
  it("subtotal 1000, rate 20% → kdv_amount 200.00, total 1200.00", () => {
    expect(calculateKdv(1000, 20)).toBe("200.00");
    expect(calculateTotal(1000, 20)).toBe("1200.00");
  });

  it("subtotal 999.99, rate 10% → kdv_amount 100.00 (rounded to 2dp), total 1099.99", () => {
    // 999.99 × 10% = 99.999 → rounded to 100.00
    expect(calculateKdv("999.99", 10)).toBe("100.00");
    expect(calculateTotal("999.99", 10)).toBe("1099.99");
  });

  it("kdv_rate 0% → kdv_amount 0.00, total = subtotal exactly", () => {
    expect(calculateKdv(1000, 0)).toBe("0.00");
    expect(calculateTotal(1000, 0)).toBe("1000.00");
  });
});

describe("calculateLineItem", () => {
  it("computes all amounts for a simple line", () => {
    const line = calculateLineItem(10, 50, 20);
    expect(line.subtotal).toBe("500.00");
    expect(line.kdvAmount).toBe("100.00");
    expect(line.total).toBe("600.00");
  });

  it("handles fractional quantities (e.g. kg)", () => {
    // 2.5 kg × 40.00 TL/kg = 100.00 subtotal
    const line = calculateLineItem("2.5", "40", 20);
    expect(line.subtotal).toBe("100.00");
    expect(line.kdvAmount).toBe("20.00");
    expect(line.total).toBe("120.00");
  });

  it("handles high precision unit prices", () => {
    // 3 × 33.3333 = 99.9999 → 100.00 after rounding
    const line = calculateLineItem(3, "33.3333", 10);
    expect(line.subtotal).toBe("100.00");
    expect(line.kdvAmount).toBe("10.00");
    expect(line.total).toBe("110.00");
  });

  it("handles string inputs matching Drizzle decimal return types", () => {
    const line = calculateLineItem("7.0000", "14.2900", "20.00");
    // 7 × 14.29 = 100.03
    expect(line.subtotal).toBe("100.03");
    // 100.03 × 0.20 = 20.006 → 20.01
    expect(line.kdvAmount).toBe("20.01");
    expect(line.total).toBe("120.04");
  });

  it("ensures total = subtotal + kdvAmount (no drift)", () => {
    const line = calculateLineItem("7", "14.29", 20);
    const expectedTotal = (
      parseFloat(line.subtotal) + parseFloat(line.kdvAmount)
    ).toFixed(2);
    expect(line.total).toBe(expectedTotal);
  });
});

describe("extractSubtotalFromTotal", () => {
  it("extracts subtotal from KDV-inclusive total at 20%", () => {
    // 1200 / 1.20 = 1000
    expect(extractSubtotalFromTotal(1200, 20)).toBe("1000.00");
  });

  it("extracts subtotal from KDV-inclusive total at 10%", () => {
    // 550 / 1.10 = 500
    expect(extractSubtotalFromTotal(550, 10)).toBe("500.00");
  });

  it("handles rounding in reverse calculation", () => {
    // 121 / 1.20 = 100.8333... → 100.83
    expect(extractSubtotalFromTotal(121, 20)).toBe("100.83");
  });

  it("returns same value for exempt rate", () => {
    expect(extractSubtotalFromTotal(1000, 0)).toBe("1000.00");
  });

  it("handles string inputs", () => {
    expect(extractSubtotalFromTotal("1200.00", "20")).toBe("1000.00");
  });
});
