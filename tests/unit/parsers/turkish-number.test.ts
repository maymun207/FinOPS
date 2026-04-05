/**
 * @vitest-environment node
 *
 * Exhaustive tests for the Turkish number format parser.
 *
 * Covers every case from the spec + edge cases.
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { parseTurkishNumber, tryParseTurkishNumber, ParseError } from "@/lib/parsers";

describe("parseTurkishNumber", () => {
  // ── Standard Turkish format ─────────────────────────────────────
  describe("Standard Turkish (dot thousand, comma decimal)", () => {
    it("'1.234,56' → 1234.56", () => {
      expect(parseTurkishNumber("1.234,56").toNumber()).toBe(1234.56);
    });

    it("'12.345.678,90' → 12345678.90", () => {
      expect(parseTurkishNumber("12.345.678,90").toNumber()).toBe(12345678.90);
    });

    it("'999.999,99' → 999999.99", () => {
      expect(parseTurkishNumber("999.999,99").toNumber()).toBe(999999.99);
    });
  });

  // ── English format (Excel en-US) ────────────────────────────────
  describe("English format (comma thousand, dot decimal)", () => {
    it("'1,234.56' → 1234.56", () => {
      expect(parseTurkishNumber("1,234.56").toNumber()).toBe(1234.56);
    });

    it("'12,345,678.90' → 12345678.90", () => {
      expect(parseTurkishNumber("12,345,678.90").toNumber()).toBe(12345678.90);
    });
  });

  // ── No thousand separator ───────────────────────────────────────
  describe("No thousand separator", () => {
    it("'1234,56' → 1234.56 (comma decimal)", () => {
      expect(parseTurkishNumber("1234,56").toNumber()).toBe(1234.56);
    });

    it("'1234.56' → 1234.56 (dot decimal)", () => {
      expect(parseTurkishNumber("1234.56").toNumber()).toBe(1234.56);
    });

    it("'0,50' → 0.50", () => {
      expect(parseTurkishNumber("0,50").toNumber()).toBe(0.5);
    });
  });

  // ── Integer with Turkish thousand separator ─────────────────────
  describe("Integer with Turkish thousand separator", () => {
    it("'1.234' → 1234.00 (3-digit group → thousand sep)", () => {
      const result = parseTurkishNumber("1.234");
      expect(result.toNumber()).toBe(1234);
    });

    it("'123.456.789' → 123456789 (multiple thousand seps)", () => {
      expect(parseTurkishNumber("123.456.789").toNumber()).toBe(123456789);
    });
  });

  // ── Ambiguous comma ─────────────────────────────────────────────
  describe("Ambiguous comma (treat as thousand separator)", () => {
    it("'1,234' → 1234 (3-digit group after comma)", () => {
      expect(parseTurkishNumber("1,234").toNumber()).toBe(1234);
    });
  });

  // ── KDV rate with percent sign ──────────────────────────────────
  describe("Percent sign", () => {
    it("'%20' → 20.00", () => {
      expect(parseTurkishNumber("%20").toNumber()).toBe(20);
    });

    it("'20%' → 20.00", () => {
      expect(parseTurkishNumber("20%").toNumber()).toBe(20);
    });

    it("'%18' → 18.00", () => {
      expect(parseTurkishNumber("%18").toNumber()).toBe(18);
    });

    it("'%0' → 0", () => {
      expect(parseTurkishNumber("%0").toNumber()).toBe(0);
    });
  });

  // ── Negative numbers ────────────────────────────────────────────
  describe("Negative numbers", () => {
    it("'-1.234,56' → -1234.56", () => {
      expect(parseTurkishNumber("-1.234,56").toNumber()).toBe(-1234.56);
    });

    it("'-500' → -500", () => {
      expect(parseTurkishNumber("-500").toNumber()).toBe(-500);
    });

    it("'(1.234,56)' → -1234.56 (accounting parentheses)", () => {
      expect(parseTurkishNumber("(1.234,56)").toNumber()).toBe(-1234.56);
    });
  });

  // ── Plain integers ──────────────────────────────────────────────
  describe("Plain integers", () => {
    it("'100' → 100", () => {
      expect(parseTurkishNumber("100").toNumber()).toBe(100);
    });

    it("'0' → 0", () => {
      expect(parseTurkishNumber("0").toNumber()).toBe(0);
    });

    it("'999999' → 999999", () => {
      expect(parseTurkishNumber("999999").toNumber()).toBe(999999);
    });
  });

  // ── Numeric input ───────────────────────────────────────────────
  describe("Numeric input (already a number)", () => {
    it("1234.56 → 1234.56", () => {
      expect(parseTurkishNumber(1234.56).toNumber()).toBe(1234.56);
    });

    it("0 → 0", () => {
      expect(parseTurkishNumber(0).toNumber()).toBe(0);
    });

    it("-99.99 → -99.99", () => {
      expect(parseTurkishNumber(-99.99).toNumber()).toBe(-99.99);
    });
  });

  // ── Currency symbols ────────────────────────────────────────────
  describe("Currency symbols stripped", () => {
    it("'₺1.234,56' → 1234.56", () => {
      expect(parseTurkishNumber("₺1.234,56").toNumber()).toBe(1234.56);
    });

    it("'$100.50' → 100.50", () => {
      expect(parseTurkishNumber("$100.50").toNumber()).toBe(100.5);
    });

    it("'€50,00' → 50.00", () => {
      expect(parseTurkishNumber("€50,00").toNumber()).toBe(50);
    });
  });

  // ── Whitespace handling ─────────────────────────────────────────
  describe("Whitespace handling", () => {
    it("'  1234,56  ' → 1234.56 (trimmed)", () => {
      expect(parseTurkishNumber("  1234,56  ").toNumber()).toBe(1234.56);
    });

    it("' - 500 ' → -500 (trimmed with spaces around minus)", () => {
      expect(parseTurkishNumber(" - 500 ").toNumber()).toBe(-500);
    });
  });

  // ── Error cases ─────────────────────────────────────────────────
  describe("Error cases → ParseError", () => {
    it("'' → throws ParseError", () => {
      expect(() => parseTurkishNumber("")).toThrow(ParseError);
    });

    it("null → throws ParseError", () => {
      expect(() => parseTurkishNumber(null)).toThrow(ParseError);
    });

    it("undefined → throws ParseError", () => {
      expect(() => parseTurkishNumber(undefined)).toThrow(ParseError);
    });

    it("'abc' → throws ParseError", () => {
      expect(() => parseTurkishNumber("abc")).toThrow(ParseError);
    });

    it("Infinity → throws ParseError", () => {
      expect(() => parseTurkishNumber(Infinity)).toThrow(ParseError);
    });

    it("NaN → throws ParseError", () => {
      expect(() => parseTurkishNumber(NaN)).toThrow(ParseError);
    });
  });

  // ── Decimal.js precision ────────────────────────────────────────
  describe("Decimal.js precision", () => {
    it("result is a Decimal instance", () => {
      const result = parseTurkishNumber("1.234,56");
      expect(result).toBeInstanceOf(Decimal);
    });

    it("preserves 2 decimal places", () => {
      const result = parseTurkishNumber("1.234,50");
      expect(result.toFixed(2)).toBe("1234.50");
    });
  });
});

describe("tryParseTurkishNumber", () => {
  it("returns Decimal on valid input", () => {
    const result = tryParseTurkishNumber("1.234,56");
    expect(result).not.toBeNull();
    expect(result!.toNumber()).toBe(1234.56);
  });

  it("returns null on invalid input", () => {
    expect(tryParseTurkishNumber("")).toBeNull();
    expect(tryParseTurkishNumber(null)).toBeNull();
    expect(tryParseTurkishNumber("abc")).toBeNull();
  });
});
