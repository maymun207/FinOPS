/**
 * Excel Date Parser — converts Excel serial dates and string dates to ISO format.
 *
 * Handles:
 *   44927          → '2023-01-01'   (Excel serial: days since 1900-01-01, with Lotus bug)
 *   '01.01.2023'   → '2023-01-01'  (Turkish DD.MM.YYYY)
 *   '01/01/2023'   → '2023-01-01'  (DD/MM/YYYY)
 *   '2023-01-01'   → '2023-01-01'  (ISO 8601)
 *   'Jan 2023'     → throw ParseError (Ambiguous month name)
 *   '' / null       → throw ParseError
 *
 * Design: Pure function, no dependencies.
 */

import { ParseError } from "./turkish-number";

// ── Excel serial date epoch ────────────────────────────────────────
// Excel uses 1900-01-01 as day 1, but includes a Lotus 123 bug
// that treats 1900 as a leap year (it's not). Serial 60 represents
// the non-existent Feb 29, 1900. For serials > 59 we subtract 1
// to correct for this phantom day.
//
// Epoch = Dec 31, 1899 so that: epoch + 1 day = Jan 1, 1900 = serial 1.
const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 31)); // Dec 31, 1899

/**
 * Convert an Excel serial number to an ISO date string.
 *
 * Lotus 123 bug handling:
 *   serial 1  = 1900-01-01
 *   serial 59 = 1900-02-28
 *   serial 60 = 1900-02-29 (DOES NOT EXIST — Lotus bug; we map to Feb 28)
 *   serial 61 = 1900-03-01
 *
 * For serials >= 60, we subtract 1 to skip the phantom day.
 */
function excelSerialToISO(serial: number, field?: string): string {
  if (serial < 1 || serial > 2958465) {
    // 2958465 = Dec 31, 9999
    throw new ParseError(
      `Excel seri numarası aralık dışında: ${String(serial)}`,
      serial,
      field
    );
  }

  // Adjust for the Lotus bug: serials > 59 are off by 1
  const adjusted = serial > 59 ? serial - 1 : serial;

  const ms = EXCEL_EPOCH.getTime() + adjusted * 86400000;
  const d = new Date(ms);

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

// ── String date patterns ───────────────────────────────────────────

/** DD.MM.YYYY or DD/MM/YYYY */
const DMY_REGEX = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

/** YYYY-MM-DD (ISO 8601) */
const ISO_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Validate that a parsed date is a real calendar date.
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Format a date as ISO string (YYYY-MM-DD).
 */
function toISO(year: number, month: number, day: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse an Excel date value (serial number or string) into ISO date format.
 *
 * @param raw   - Excel cell value (number or string)
 * @param field - Optional column/field name for error context
 * @returns ISO date string 'YYYY-MM-DD'
 * @throws ParseError if the value is empty, ambiguous, or unparseable
 */
export function parseExcelDate(raw: unknown, field?: string): string {
  // ── Guard: null / undefined / empty ──────────────────────────
  if (raw == null) {
    throw new ParseError("Tarih değeri boş olamaz", raw, field);
  }

  // ── Numeric: Excel serial date ───────────────────────────────
  if (typeof raw === "number") {
    return excelSerialToISO(raw, field);
  }

  const str = typeof raw === 'string' ? raw.trim() : String(raw as string | number).trim();

  if (str === "") {
    throw new ParseError("Tarih değeri boş olamaz", raw, field);
  }

  // ── Try ISO format first (YYYY-MM-DD) ────────────────────────
  const isoMatch = ISO_REGEX.exec(str);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]!, 10);
    const month = parseInt(isoMatch[2]!, 10);
    const day = parseInt(isoMatch[3]!, 10);

    if (!isValidDate(year, month, day)) {
      throw new ParseError(`Geçersiz tarih: "${str}"`, raw, field);
    }
    return toISO(year, month, day);
  }

  // ── Try DD.MM.YYYY or DD/MM/YYYY ─────────────────────────────
  const dmyMatch = DMY_REGEX.exec(str);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]!, 10);
    const month = parseInt(dmyMatch[2]!, 10);
    const year = parseInt(dmyMatch[3]!, 10);

    if (!isValidDate(year, month, day)) {
      throw new ParseError(`Geçersiz tarih: "${str}"`, raw, field);
    }
    return toISO(year, month, day);
  }

  // ── If it looks like a pure integer string, try as serial ────
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str, 10);
    return excelSerialToISO(serial, field);
  }

  // ── Reject ambiguous formats ─────────────────────────────────
  throw new ParseError(
    `Belirsiz tarih formatı: "${str}". Desteklenen formatlar: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD`,
    raw,
    field
  );
}

/**
 * Try to parse — returns ISO string or null (no throw).
 */
export function tryParseExcelDate(raw: unknown, field?: string): string | null {
  try {
    return parseExcelDate(raw, field);
  } catch {
    return null;
  }
}
