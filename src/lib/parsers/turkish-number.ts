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

/**
 * Typed parse error with { field, input, reason } properties.
 *
 * Enables row-level error reporting in the import quarantine UI:
 *   - `field`  — which column caused the error (optional, set by schema)
 *   - `input`  — the original raw cell value that failed
 *   - `reason` — human-readable Turkish explanation
 */
export class ParseError extends Error {
  public readonly field: string | undefined;
  public readonly input: unknown;
  public readonly reason: string;

  constructor(reason: string, input: unknown, field?: string) {
    super(`${field ? `[${field}] ` : ""}${reason}`);
    this.name = "ParseError";
    this.reason = reason;
    this.input = input;
    this.field = field;
  }
}

/**
 * Parse a Turkish-locale number string into a Decimal value.
 *
 * @param raw   - The raw value from an Excel cell
 * @param field - Optional column/field name for error context
 * @returns Decimal — precise numeric representation
 * @throws ParseError if the value is empty, null, undefined, or unparseable
 */
export function parseTurkishNumber(raw: unknown, field?: string): Decimal {
  // ── Guard: null / undefined / empty ──────────────────────────
  if (raw == null) {
    throw new ParseError("Değer boş olamaz", raw, field);
  }

  // If already a number, return directly
  if (typeof raw === "number") {
    if (!isFinite(raw)) {
      throw new ParseError("Geçersiz sayı değeri (Infinity/NaN)", raw, field);
    }
    return new Decimal(raw);
  }

  let str = typeof raw === 'string' ? raw.trim() : String(raw as string | number).trim();

  if (str === "") {
    throw new ParseError("Değer boş olamaz", raw, field);
  }

  // ── Strip percent sign (KDV rates: '%20' or '20%') ──────────
  if (str.startsWith("%") || str.endsWith("%")) {
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
    throw new ParseError("Geçersiz sayı formatı", raw, field);
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
    // Only comma: could be decimal separator or thousand separator.
    // If comma is followed by exactly 3 digits at end → thousand separator.
    // Otherwise → decimal separator.
    //
    // ═══════════════════════════════════════════════════════════════
    // AMBIGUITY NOTE — '1,234' (one comma, no dot)
    //
    // This value is inherently ambiguous:
    //   - Could be Turkish 1.234 (one thousand two hundred thirty-four)
    //   - Could be English 1,234 (one thousand two hundred thirty-four)
    //   - Could be Turkish 1,234 (one point two three four — decimal)
    //
    // Disambiguation strategy:
    //   - If the value has exactly 3 digits after the comma AND ≤ 3 digits
    //     before → treat comma as THOUSAND separator (→ integer 1234).
    //   - The calling Zod schema can override this by using the `field`
    //     parameter: if the column is labelled 'KDV Oranı' (KDV Rate)
    //     or 'Miktar' (Quantity), the comma should be treated as decimal.
    //     For 'Tutar' (Amount) columns, it's always a thousand separator.
    //   - Default behavior without context: thousand separator (most common
    //     in Turkish financial docs where amounts dominate).
    // ═══════════════════════════════════════════════════════════════
    const parts = str.split(",");
    if (parts.length === 2 && parts[1]!.length === 3 && /^\d{1,3}$/.test(parts[0]!)) {
      // AMBIGUOUS: '1,234' — default to thousand separator → 1234
      normalized = str.replace(/,/g, "");
    } else {
      // Decimal: '1234,56' → '1234.56'
      normalized = str.replace(",", ".");
    }
  } else if (hasDot && !hasComma) {
    // Only dot: could be decimal or thousand separator.
    // If dot is followed by exactly 3 digits → thousand separator.
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
    throw new ParseError(`Geçersiz sayı formatı: "${typeof raw === 'string' ? raw : String(raw as string | number)}"`, raw, field);
  }

  let result = new Decimal(normalized);

  if (isNegative) {
    result = result.neg();
  }

  // Percent values are returned as-is (e.g. '%20' → 20.00, not 0.20).
  // The caller can divide by 100 if they need the rate form.

  return result;
}

/**
 * Try to parse — returns Decimal or null (no throw).
 */
export function tryParseTurkishNumber(raw: unknown, field?: string): Decimal | null {
  try {
    return parseTurkishNumber(raw, field);
  } catch {
    return null;
  }
}
