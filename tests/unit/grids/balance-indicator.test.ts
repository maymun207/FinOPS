/**
 * Unit tests: BalanceIndicator logic
 *
 * Tests the balance check logic used in the debit/credit indicator.
 * Pure function tests — no JSX/DOM required.
 */
import { describe, it, expect } from "vitest";
import {
  isBalanced,
  balanceDifference,
} from "@/components/grids/balance-utils";

describe("isBalanced — debit/credit balance check", () => {
  it("debit 1000, credit 1000 → balanced state", () => {
    expect(isBalanced(1000, 1000)).toBe(true);
  });

  it("debit 1000, credit 999.99 → unbalanced state, diff = 0.01", () => {
    expect(isBalanced(1000, 999.99)).toBe(false);
    expect(balanceDifference(1000, 999.99)).toBeCloseTo(0.01, 10);
  });

  it("debit 0, credit 0 → balanced (empty entry is balanced)", () => {
    expect(isBalanced(0, 0)).toBe(true);
  });

  // ── Additional coverage ───────────────────────────────────────────

  it("returns true within floating point tolerance (0.004)", () => {
    expect(isBalanced(100.004, 100)).toBe(true);
  });

  it("returns true within tolerance (0.0049)", () => {
    expect(isBalanced(100, 100.0049)).toBe(true);
  });

  it("returns false when difference exceeds tolerance boundary (>0.005)", () => {
    expect(isBalanced(100.006, 100)).toBe(false);
  });

  it("returns false for clearly unbalanced totals", () => {
    expect(isBalanced(1500, 1000)).toBe(false);
  });

  it("returns false when debit is greater by 0.01", () => {
    expect(isBalanced(500.01, 500)).toBe(false);
  });

  it("returns false when credit is greater by 0.01", () => {
    expect(isBalanced(500, 500.01)).toBe(false);
  });

  it("handles large balanced amounts", () => {
    expect(isBalanced(999999999.99, 999999999.99)).toBe(true);
  });

  it("handles large unbalanced amounts", () => {
    expect(isBalanced(999999999.99, 999999999.98)).toBe(false);
  });
});

describe("balanceDifference — debit minus credit", () => {
  it("returns 0 for equal amounts", () => {
    expect(balanceDifference(1000, 1000)).toBe(0);
  });

  it("returns positive when debit exceeds credit", () => {
    expect(balanceDifference(1500, 1000)).toBe(500);
  });

  it("returns negative when credit exceeds debit", () => {
    expect(balanceDifference(1000, 1500)).toBe(-500);
  });

  it("returns 0 for zero totals", () => {
    expect(balanceDifference(0, 0)).toBe(0);
  });

  it("handles decimal precision", () => {
    const diff = balanceDifference(100.55, 100.5);
    expect(Math.abs(diff - 0.05)).toBeLessThan(0.001);
  });
});
