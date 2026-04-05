/**
 * @vitest-environment node
 *
 * Exhaustive tests for the Excel date parser.
 *
 * Covers: Excel serial dates (with Lotus bug), Turkish DD.MM.YYYY,
 * DD/MM/YYYY, ISO 8601, and error cases.
 */
import { describe, it, expect } from "vitest";
import { parseExcelDate, tryParseExcelDate, ParseError } from "@/lib/parsers";

describe("parseExcelDate", () => {
  // ── Excel serial dates ──────────────────────────────────────────
  describe("Excel serial dates (Lotus bug handled)", () => {
    it("44927 → '2023-01-01'", () => {
      expect(parseExcelDate(44927)).toBe("2023-01-01");
    });

    it("1 → '1900-01-01' (day 1)", () => {
      expect(parseExcelDate(1)).toBe("1900-01-01");
    });

    it("59 → '1900-02-28' (last day before Lotus bug)", () => {
      expect(parseExcelDate(59)).toBe("1900-02-28");
    });

    it("61 → '1900-03-01' (first day after Lotus bug skip)", () => {
      expect(parseExcelDate(61)).toBe("1900-03-01");
    });

    it("43831 → '2020-01-01'", () => {
      expect(parseExcelDate(43831)).toBe("2020-01-01");
    });

    it("45292 → '2024-01-01'", () => {
      expect(parseExcelDate(45292)).toBe("2024-01-01");
    });

    it("serial as string '44927' → '2023-01-01'", () => {
      expect(parseExcelDate("44927")).toBe("2023-01-01");
    });
  });

  // ── Turkish DD.MM.YYYY ──────────────────────────────────────────
  describe("Turkish DD.MM.YYYY format", () => {
    it("'01.01.2023' → '2023-01-01'", () => {
      expect(parseExcelDate("01.01.2023")).toBe("2023-01-01");
    });

    it("'15.06.2024' → '2024-06-15'", () => {
      expect(parseExcelDate("15.06.2024")).toBe("2024-06-15");
    });

    it("'31.12.2025' → '2025-12-31'", () => {
      expect(parseExcelDate("31.12.2025")).toBe("2025-12-31");
    });

    it("'1.1.2023' → '2023-01-01' (single digit day/month)", () => {
      expect(parseExcelDate("1.1.2023")).toBe("2023-01-01");
    });
  });

  // ── DD/MM/YYYY ──────────────────────────────────────────────────
  describe("DD/MM/YYYY format", () => {
    it("'01/01/2023' → '2023-01-01'", () => {
      expect(parseExcelDate("01/01/2023")).toBe("2023-01-01");
    });

    it("'28/02/2024' → '2024-02-28'", () => {
      expect(parseExcelDate("28/02/2024")).toBe("2024-02-28");
    });

    it("'29/02/2024' → '2024-02-29' (leap year)", () => {
      expect(parseExcelDate("29/02/2024")).toBe("2024-02-29");
    });
  });

  // ── ISO 8601 ────────────────────────────────────────────────────
  describe("ISO 8601 format", () => {
    it("'2023-01-01' → '2023-01-01'", () => {
      expect(parseExcelDate("2023-01-01")).toBe("2023-01-01");
    });

    it("'2024-12-31' → '2024-12-31'", () => {
      expect(parseExcelDate("2024-12-31")).toBe("2024-12-31");
    });

    it("'2024-2-1' → '2024-02-01' (single digit)", () => {
      expect(parseExcelDate("2024-2-1")).toBe("2024-02-01");
    });
  });

  // ── Whitespace handling ─────────────────────────────────────────
  describe("Whitespace handling", () => {
    it("'  2023-01-01  ' → '2023-01-01' (trimmed)", () => {
      expect(parseExcelDate("  2023-01-01  ")).toBe("2023-01-01");
    });

    it("'  01.01.2023  ' → '2023-01-01' (trimmed)", () => {
      expect(parseExcelDate("  01.01.2023  ")).toBe("2023-01-01");
    });
  });

  // ── Error cases ─────────────────────────────────────────────────
  describe("Error cases → ParseError", () => {
    it("'Jan 2023' → throws ParseError (ambiguous month name)", () => {
      expect(() => parseExcelDate("Jan 2023")).toThrow(ParseError);
    });

    it("'' → throws ParseError", () => {
      expect(() => parseExcelDate("")).toThrow(ParseError);
    });

    it("null → throws ParseError", () => {
      expect(() => parseExcelDate(null)).toThrow(ParseError);
    });

    it("undefined → throws ParseError", () => {
      expect(() => parseExcelDate(undefined)).toThrow(ParseError);
    });

    it("'abc' → throws ParseError", () => {
      expect(() => parseExcelDate("abc")).toThrow(ParseError);
    });

    it("'32.01.2023' → throws ParseError (invalid day)", () => {
      expect(() => parseExcelDate("32.01.2023")).toThrow(ParseError);
    });

    it("'29.02.2023' → throws ParseError (not a leap year)", () => {
      expect(() => parseExcelDate("29.02.2023")).toThrow(ParseError);
    });

    it("0 → throws ParseError (serial < 1)", () => {
      expect(() => parseExcelDate(0)).toThrow(ParseError);
    });

    it("-1 → throws ParseError (negative serial)", () => {
      expect(() => parseExcelDate(-1)).toThrow(ParseError);
    });

    it("'2023/01/01' → throws ParseError (YYYY/MM/DD not supported)", () => {
      // This would match DMY as day=2023 which is invalid
      expect(() => parseExcelDate("2023/01/01")).toThrow(ParseError);
    });
  });
});

describe("tryParseExcelDate", () => {
  it("returns ISO string on valid input", () => {
    expect(tryParseExcelDate("01.01.2023")).toBe("2023-01-01");
    expect(tryParseExcelDate(44927)).toBe("2023-01-01");
  });

  it("returns null on invalid input", () => {
    expect(tryParseExcelDate("")).toBeNull();
    expect(tryParseExcelDate(null)).toBeNull();
    expect(tryParseExcelDate("Jan 2023")).toBeNull();
  });
});
