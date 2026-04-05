/**
 * KDV (Katma Değer Vergisi) calculation utilities.
 *
 * Uses decimal.js for ALL monetary arithmetic to avoid JavaScript
 * floating-point drift. This is critical because:
 * 1. Drizzle returns Postgres numeric/decimal columns as strings
 * 2. Native JS + and * on monetary values cause rounding errors
 *
 * All functions accept string | number inputs (matching Drizzle's return type)
 * and return string outputs for direct insertion into decimal columns.
 *
 * Pure functions — no DB or side effects.
 * Shared between server and client code.
 */
import Decimal from "decimal.js";

// Configure Decimal.js for financial math
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Standard Turkish KDV rates */
export const KDV_RATES = {
  /** Standard rate — most goods and services */
  STANDARD: 20,
  /** Reduced rate — basic food, textiles, tourism */
  REDUCED: 10,
  /** Super-reduced rate — newspapers, unprocessed food */
  SUPER_REDUCED: 1,
  /** Exempt — exports, international transport */
  EXEMPT: 0,
} as const;

export type KdvRate = (typeof KDV_RATES)[keyof typeof KDV_RATES];

/**
 * Round a Decimal to the specified decimal places.
 * Returns a string suitable for Postgres decimal columns.
 */
export function roundTo(
  value: Decimal.Value,
  decimals = 2,
): string {
  return new Decimal(value).toFixed(decimals);
}

/**
 * Calculate KDV amount from a base (subtotal) and rate.
 *
 * @param subtotal - Amount before tax (string | number)
 * @param kdvRate  - KDV percentage (e.g. 20 for %20)
 * @returns KDV amount as string with 2 decimal places
 */
export function calculateKdv(
  subtotal: Decimal.Value,
  kdvRate: Decimal.Value,
): string {
  return new Decimal(subtotal)
    .mul(new Decimal(kdvRate).div(100))
    .toFixed(2);
}

/**
 * Calculate the total (subtotal + KDV).
 *
 * @param subtotal - Amount before tax
 * @param kdvRate  - KDV percentage
 * @returns Total amount as string with 2 decimal places
 */
export function calculateTotal(
  subtotal: Decimal.Value,
  kdvRate: Decimal.Value,
): string {
  const sub = new Decimal(subtotal);
  const kdv = sub.mul(new Decimal(kdvRate).div(100));
  return sub.plus(kdv).toFixed(2);
}

/**
 * Calculate line item amounts from quantity × unit_price.
 *
 * @param quantity  - Number of units (string | number)
 * @param unitPrice - Price per unit (string | number)
 * @param kdvRate   - KDV percentage
 * @returns All computed line amounts as strings with proper precision
 */
export function calculateLineItem(
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
  kdvRate: Decimal.Value,
): {
  subtotal: string;
  kdvAmount: string;
  total: string;
} {
  const q = new Decimal(quantity);
  const p = new Decimal(unitPrice);
  const sub = q.mul(p).toDecimalPlaces(2);
  const kdv = sub.mul(new Decimal(kdvRate).div(100)).toDecimalPlaces(2);
  const tot = sub.plus(kdv);

  return {
    subtotal: sub.toFixed(2),
    kdvAmount: kdv.toFixed(2),
    total: tot.toFixed(2),
  };
}

/**
 * Reverse-calculate: extract subtotal from a KDV-inclusive total.
 *
 * @param totalInclKdv - Amount including KDV
 * @param kdvRate      - KDV percentage
 * @returns Subtotal (before KDV) as string with 2 decimal places
 */
export function extractSubtotalFromTotal(
  totalInclKdv: Decimal.Value,
  kdvRate: Decimal.Value,
): string {
  return new Decimal(totalInclKdv)
    .div(new Decimal(1).plus(new Decimal(kdvRate).div(100)))
    .toFixed(2);
}
