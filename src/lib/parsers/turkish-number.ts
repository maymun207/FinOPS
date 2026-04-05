/**
 * Turkish Number Parser — converts Turkish-locale number strings to Decimal.
 *
 * Handles all formats found in Turkish Excel exports:
 *   '1.234,56'   → 1234.56   (Standard Turkish: dot thousand, comma decimal)
 *   '1,234.56'   → 1234.56   (Excel en-US: comma thousand, dot decimal)
 *   '1234,56'    → 1234.56   (No thousand separator, comma decimal)
 *   '1234.56'    → 1234.56   (No thousand separator, dot decimal)
 *   '1.234'      → 1234.00   (Integer with Turkish thousand sep)
 *   '1,234'      → 1234      (AMBIGUOUS — treat as 1234)
 *   '%20'        → 20.00     (KDV rate with percent sign)
 *   '-1.234,56'  → -1234.56  (Negative)
 *   '' / null / undefined     → throw ParseError
 *
 * Design: Pure function, no side effects, no dependencies except Decimal.js.
 */
import Decimal from "decimal.js";

export class ParseError extends Error {
  constructor(message: string, public readonly rawValue: unknown) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parse a Turkish-locale number string into a Decimal value.
 *
 * @param raw - The raw value from an Excel cell
 * @returns Decimal — precise numeric representation
 * @throws ParseError if the value is empty, null, undefined, or unparseable
 */
export function parseTurkishNumber(raw: unknown): Decimal {
  // ── Guard: null / undefined / empty ──────────────────────────
  if (raw == null) {
    throw new ParseError("Değer boş olamaz", raw);
  }

  // If already a number, return directly
  if (typeof raw === "number") {
    if (!isFinite(raw)) {
      throw new ParseError("Geçersiz sayı değeri (Infinity/NaN)", raw);
    }
    return new Decimal(raw);
  }

  let str = String(raw).trim();

  if (str === "") {
    throw new ParseError("Değer boş olamaz", raw);
  }

  // ── Strip percent sign (KDV rates: '%20' or '20%') ──────────
  let isPercent = false;
  if (str.startsWith("%") || str.endsWith("%")) {
    isPercent = true;
    str = str.replace(/%/g, "").trim();
  }

  // ── Strip currency symbols ───────────────────────────────────
  str = str.replace(/[₺$€£]/g, "").trim();

  // ── Handle negative: leading/trailing minus or parentheses ──
  let isNegative = false;
  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith("(") && str.endsWith(")")) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  if (str === "") {
    throw new ParseError("Geçersiz sayı formatı", raw);
  }

  // ── Detect format and normalize ──────────────────────────────
  const hasDot = str.includes(".");
  const hasComma = str.includes(",");

  let normalized: string;

  if (hasDot && hasComma) {
    // Both separators present — determine which is decimal
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");

    if (lastComma > lastDot) {
      // Turkish: 1.234,56 → dot is thousand, comma is decimal
      normalized = str.replace(/\./g, "").replace(",", ".");
    } else {
      // English: 1,234.56 → comma is thousand, dot is decimal
      normalized = str.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Only comma: could be decimal separator or thousand separator
    // If comma is followed by exactly 3 digits at end → thousand separator
    // Otherwise → decimal separator
    const parts = str.split(",");
    if (parts.length === 2 && parts[1]!.length === 3 && /^\d{1,3}$/.test(parts[0]!)) {
      // AMBIGUOUS: '1,234' — treat as integer 1234
      normalized = str.replace(/,/g, "");
    } else {
      // Decimal: '1234,56' → '1234.56'
      normalized = str.replace(",", ".");
    }
  } else if (hasDot && !hasComma) {
    // Only dot: could be decimal or thousand separator
    // If dot is followed by exactly 3 digits → thousand separator
    const parts = str.split(".");
    if (parts.length === 2 && parts[1]!.length === 3 && /^\d{1,3}$/.test(parts[0]!)) {
      // Turkish thousand sep: '1.234' → 1234
      normalized = str.replace(/\./g, "");
    } else if (parts.length > 2) {
      // Multiple dots: '1.234.567' → thousand separators
      normalized = str.replace(/\./g, "");
    } else {
      // Decimal: '1234.56'
      normalized = str;
    }
  } else {
    // No separators: plain integer
    normalized = str;
  }

  // ── Strip any remaining whitespace/spaces ────────────────────
  normalized = normalized.replace(/\s/g, "");

  // ── Validate: only digits and at most one dot ────────────────
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new ParseError(`Geçersiz sayı formatı: "${raw}"`, raw);
  }

  let result = new Decimal(normalized);

  if (isNegative) {
    result = result.neg();
  }

  // Percent values are divided by 100 only if the caller wants rate form.
  // For KDV display ('%20' → 20.00), we return the raw number.
  // The caller can divide by 100 if needed for rate.
  // Per spec: '%20' → 20.00
  // So we return the number as-is (20.00, not 0.20)

  return result;
}

/**
 * Try to parse — returns Decimal or null (no throw).
 */
export function tryParseTurkishNumber(raw: unknown): Decimal | null {
  try {
    return parseTurkishNumber(raw);
  } catch {
    return null;
  }
}
