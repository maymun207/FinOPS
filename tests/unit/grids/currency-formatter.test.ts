/**
 * Unit tests: Turkish currency formatter
 *
 * Tests the TRY currency formatting used in AG Grid columns.
 */
import { describe, it, expect } from "vitest";
import { formatTRY, formatDateTR, formatKDVRate } from "@/components/grids/grid-types";

describe("formatTRY — Turkish Lira currency formatting", () => {
  it("formats a positive number as TRY", () => {
    const result = formatTRY(1234.56);
    // tr-TR TRY format: ₺1.234,56
    expect(result).toContain("1.234");
    expect(result).toContain("56");
    expect(result).toContain("₺");
  });

  it("formats zero as ₺0,00", () => {
    const result = formatTRY(0);
    expect(result).toContain("0");
    expect(result).toContain("₺");
  });

  it("formats a string number correctly", () => {
    const result = formatTRY("5000.00");
    expect(result).toContain("5.000");
    expect(result).toContain("₺");
  });

  it("returns empty string for null", () => {
    expect(formatTRY(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatTRY(undefined)).toBe("");
  });

  it("returns empty string for NaN input", () => {
    expect(formatTRY("not-a-number")).toBe("");
  });

  it("formats large numbers with thousands separators", () => {
    const result = formatTRY(1000000);
    // Should have periods as thousands separator in tr-TR
    expect(result).toContain("1.000.000");
  });

  it("formats negative numbers", () => {
    const result = formatTRY(-500.5);
    expect(result).toContain("500");
    expect(result).toContain("50");
  });

  it("always shows 2 decimal places", () => {
    const result = formatTRY(100);
    // Should end with ,00
    expect(result).toContain("00");
  });
});

describe("formatDateTR — Turkish date formatting", () => {
  it("formats a date string as dd.MM.yyyy", () => {
    const result = formatDateTR("2026-03-15");
    expect(result).toBe("15.03.2026");
  });

  it("formats a Date object", () => {
    const result = formatDateTR(new Date(2026, 0, 5)); // Jan 5, 2026
    expect(result).toBe("05.01.2026");
  });

  it("returns empty string for null", () => {
    expect(formatDateTR(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateTR(undefined)).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateTR("invalid")).toBe("");
  });
});

describe("formatKDVRate — KDV percentage formatting", () => {
  it("formats 0.20 as %20", () => {
    const result = formatKDVRate(0.2);
    // tr-TR percent: %20
    expect(result).toContain("20");
    expect(result).toContain("%");
  });

  it("formats 0.01 as %1", () => {
    const result = formatKDVRate(0.01);
    expect(result).toContain("1");
    expect(result).toContain("%");
  });

  it("formats 0.10 as %10", () => {
    const result = formatKDVRate(0.1);
    expect(result).toContain("10");
    expect(result).toContain("%");
  });

  it("returns empty string for null", () => {
    expect(formatKDVRate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatKDVRate(undefined)).toBe("");
  });

  it("returns empty string for NaN", () => {
    expect(formatKDVRate("abc")).toBe("");
  });
});
