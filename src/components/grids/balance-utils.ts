/**
 * Balance check logic — pure functions with no JSX dependency.
 *
 * Separated from BalanceIndicator.tsx so unit tests can import
 * without needing JSX transform.
 */

/** Floating point tolerance for balance check */
export const BALANCE_TOLERANCE = 0.005;

/**
 * Determine if debit and credit totals are balanced.
 * Uses a tolerance of 0.005 to handle floating point rounding.
 */
export function isBalanced(debitTotal: number, creditTotal: number): boolean {
  return Math.abs(debitTotal - creditTotal) < BALANCE_TOLERANCE;
}

/**
 * Compute the difference between debit and credit totals.
 */
export function balanceDifference(
  debitTotal: number,
  creditTotal: number
): number {
  return debitTotal - creditTotal;
}
