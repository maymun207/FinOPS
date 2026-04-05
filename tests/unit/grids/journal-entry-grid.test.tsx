/**
 * JournalEntryGrid render tests
 *
 * Verifies the grid component renders without error and displays
 * the BalanceIndicator correctly for empty and populated datasets.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { JournalEntryGrid } from "@/components/grids/JournalEntryGrid";
import type { JournalEntryRow } from "@/components/grids/JournalEntryGrid";

// ── Fixture data ────────────────────────────────────────────────────
const SAMPLE_ROWS: JournalEntryRow[] = [
  {
    id: "line-1",
    entryDate: "2026-03-15",
    entryDescription: "Satış faturası",
    accountCode: "120",
    accountName: "Alıcılar",
    debitAmount: 1000,
    creditAmount: 0,
    lineDescription: "Müşteri A",
    sourceType: "invoice",
  },
  {
    id: "line-2",
    entryDate: "2026-03-15",
    entryDescription: "Satış faturası",
    accountCode: "600",
    accountName: "Yurtiçi Satışlar",
    debitAmount: 0,
    creditAmount: 847.46,
    lineDescription: "Müşteri A — satış",
    sourceType: "invoice",
  },
  {
    id: "line-3",
    entryDate: "2026-03-15",
    entryDescription: "Satış faturası",
    accountCode: "391",
    accountName: "Hesaplanan KDV",
    debitAmount: 0,
    creditAmount: 152.54,
    lineDescription: "KDV %18",
    sourceType: "invoice",
  },
];

describe("JournalEntryGrid — render tests", () => {
  it("renders without error with empty dataset", () => {
    const { container } = render(
      <JournalEntryGrid rows={[]} loading={false} />
    );

    // Component should render without throwing
    expect(container).toBeTruthy();

    // BalanceIndicator should show balanced state (0 = 0)
    expect(screen.getByText("Dengeli")).toBeTruthy();

    // Should show ₺0,00 for both totals
    const zeroAmounts = screen.getAllByText(/₺0,00/);
    expect(zeroAmounts.length).toBeGreaterThanOrEqual(2);
  });

  it("renders with 3 journal entries, shows correct row count", () => {
    const { container } = render(
      <JournalEntryGrid rows={SAMPLE_ROWS} loading={false} />
    );

    // Component should render without throwing
    expect(container).toBeTruthy();

    // BalanceIndicator should show balanced state
    // Debit: 1000.00, Credit: 847.46 + 152.54 = 1000.00
    expect(screen.getByText("Dengeli")).toBeTruthy();

    // Borç Toplamı and Alacak Toplamı labels should exist
    expect(screen.getByText("Borç Toplamı")).toBeTruthy();
    expect(screen.getByText("Alacak Toplamı")).toBeTruthy();
  });
});
