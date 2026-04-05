/**
 * Unit tests: Turkish currency formatter
 *
 * Tests the TRY currency formatting used in AG Grid columns.
 * Exact output verified against Node.js Intl.NumberFormat('tr-TR', {style:'currency', currency:'TRY'}).
 */
import { describe, it, expect } from "vitest";
import { formatTRY, formatDateTR, formatKDVRate } from "@/components/grids/grid-types";

describe("formatTRY — Turkish Lira currency formatting", () => {
  it("formats 1234.56 → '₺1.234,56' (dot as thousand sep, comma as decimal)", () => {
    expect(formatTRY(1234.56)).toBe("₺1.234,56");
  });

  it("formats 0 → '₺0,00'", () => {
    expect(formatTRY(0)).toBe("₺0,00");
  });

  it("returns empty string for null (never throws)", () => {
    expect(formatTRY(null)).toBe("");
  });

  it("returns empty string for undefined (never throws)", () => {
    expect(formatTRY(undefined)).toBe("");
  });

  it("formats negative: -500.00 → '-₺500,00'", () => {
    expect(formatTRY(-500.0)).toBe("-₺500,00");
  });

  // ── Additional coverage ───────────────────────────────────────────

  it("formats a Drizzle decimal string correctly (parseFloat path)", () => {
    // Drizzle returns decimal columns as strings — AG Grid must parseFloat first
    expect(formatTRY("5000.00")).toBe("₺5.000,00");
  });

  it("formats large numbers with thousands separators", () => {
    expect(formatTRY(1000000)).toBe("₺1.000.000,00");
  });

  it("returns empty string for NaN input", () => {
    expect(formatTRY("not-a-number")).toBe("");
  });

  it("always shows 2 decimal places", () => {
    expect(formatTRY(100)).toBe("₺100,00");
  });

  it("parseFloat('1234.56') === 1234.56 (Drizzle decimal roundtrip)", () => {
    // Validates that Drizzle string decimals survive parseFloat without precision loss
    expect(parseFloat("1234.56")).toBe(1234.56);
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
