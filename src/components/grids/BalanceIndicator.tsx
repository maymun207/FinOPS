"use client";

/**
 * BalanceIndicator — Visual debit/credit balance check component.
 *
 * Shows a green checkmark when balanced, red warning when unbalanced.
 * Debit total and credit total are computed from the provided data.
 *
 * Tolerance: |debit - credit| < 0.005 → balanced (floating point tolerance).
 */
import React from "react";
import { formatTRY } from "./grid-types";
import { isBalanced, balanceDifference } from "./balance-utils";

export { isBalanced, balanceDifference } from "./balance-utils";

export interface BalanceIndicatorProps {
  /** Total debit amount */
  debitTotal: number;
  /** Total credit amount */
  creditTotal: number;
}

export function BalanceIndicator({
  debitTotal,
  creditTotal,
}: BalanceIndicatorProps) {
  const balanced = isBalanced(debitTotal, creditTotal);
  const diff = balanceDifference(debitTotal, creditTotal);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        backgroundColor: balanced
          ? "rgba(34, 197, 94, 0.1)"
          : "rgba(239, 68, 68, 0.1)",
        border: `1px solid ${balanced ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        fontSize: "0.875rem",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Status icon */}
      <span
        style={{
          fontSize: "1.25rem",
          color: balanced ? "#22c55e" : "#ef4444",
        }}
        role="img"
        aria-label={balanced ? "Dengeli" : "Dengesiz"}
      >
        {balanced ? "✓" : "⚠"}
      </span>

      {/* Debit total */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
          Borç Toplamı
        </span>
        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {formatTRY(debitTotal)}
        </span>
      </div>

      {/* Credit total */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
          Alacak Toplamı
        </span>
        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {formatTRY(creditTotal)}
        </span>
      </div>

      {/* Difference (only if unbalanced) */}
      {!balanced && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Fark</span>
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            {formatTRY(Math.abs(diff))}
          </span>
        </div>
      )}

      {/* Status text */}
      <span
        style={{
          marginLeft: "auto",
          color: balanced ? "#22c55e" : "#ef4444",
          fontWeight: 500,
        }}
      >
        {balanced ? "Dengeli" : "Dengesiz"}
      </span>
    </div>
  );
}
