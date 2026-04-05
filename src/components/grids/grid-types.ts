/**
 * Shared AG Grid column type definitions — Turkish locale.
 *
 * Provides reusable ColDef presets for:
 *   - TRY currency (₺) with tr-TR formatting
 *   - Turkish date formatting (dd.MM.yyyy)
 *   - KDV rate percentage display
 */
import type { ColDef, ValueFormatterParams } from "ag-grid-community";

// ── Currency ────────────────────────────────────────────────────────

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a numeric value as Turkish Lira (₺).
 * Returns empty string for null/undefined.
 */
export function formatTRY(value: unknown): string {
  if (value == null) return "";
  const n = Number(value);
  if (isNaN(n)) return "";
  return tryFormatter.format(n);
}

/**
 * AG Grid ColDef preset for TRY currency columns.
 * Right-aligned, formatted with ₺ symbol, 2 decimal places.
 */
export const TRY_COLUMN: ColDef = {
  cellDataType: "number",
  valueFormatter: (p: ValueFormatterParams) => formatTRY(p.value),
  cellClass: "ag-right-aligned-cell",
  headerClass: "ag-right-aligned-header",
  type: "rightAligned",
};

// ── Date ────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Format a date value in Turkish locale (dd.MM.yyyy).
 */
export function formatDateTR(value: unknown): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (isNaN(d.getTime())) return "";
  return dateFormatter.format(d);
}

/**
 * AG Grid ColDef preset for Turkish date columns.
 */
export const DATE_COLUMN: ColDef = {
  valueFormatter: (p: ValueFormatterParams) => formatDateTR(p.value),
  filter: "agDateColumnFilter",
};

// ── KDV Rate ────────────────────────────────────────────────────────

const percentFormatter = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a decimal rate (e.g. 0.20) as percentage (e.g. %20).
 */
export function formatKDVRate(value: unknown): string {
  if (value == null) return "";
  const n = Number(value);
  if (isNaN(n)) return "";
  return percentFormatter.format(n);
}

/**
 * AG Grid ColDef preset for KDV rate percentage columns.
 * Right-aligned, formatted as whole % (e.g. %1, %10, %20).
 */
export const KDV_RATE_COLUMN: ColDef = {
  cellDataType: "number",
  valueFormatter: (p: ValueFormatterParams) => formatKDVRate(p.value),
  cellClass: "ag-right-aligned-cell",
  headerClass: "ag-right-aligned-header",
  type: "rightAligned",
  width: 80,
};
