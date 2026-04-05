"use client";

/**
 * JournalEntryGrid — Yevmiye Defteri viewer with borç/alacak columns.
 *
 * Features:
 *   - AG Grid with Turkish locale + FinOPS dark theme
 *   - TRY currency formatting for debit/credit columns
 *   - Turkish date formatting
 *   - Inline BalanceIndicator computed from visible rows
 *   - Account code and description columns
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ColDef, GridApi, FilterChangedEvent } from "ag-grid-community";
import { BaseGrid } from "./BaseGrid";
import { BalanceIndicator } from "./BalanceIndicator";
import { TRY_COLUMN, DATE_COLUMN } from "./grid-types";

/**
 * Shape of a journal entry line row displayed in the grid.
 * Flattened from journal_entries + journal_entry_lines + chart_of_accounts.
 */
export interface JournalEntryRow {
  /** journal_entry_lines.id */
  id: string;
  /** journal_entries.entry_date */
  entryDate: string;
  /** journal_entries.description */
  entryDescription: string | null;
  /** chart_of_accounts.code */
  accountCode: string;
  /** chart_of_accounts.name */
  accountName: string;
  /** journal_entry_lines.debit_amount */
  debitAmount: number;
  /** journal_entry_lines.credit_amount */
  creditAmount: number;
  /** journal_entry_lines.description */
  lineDescription: string | null;
  /** journal_entries.source_type */
  sourceType: string;
}

/**
 * Column definitions for the journal entry grid.
 */
const JOURNAL_COLUMNS: ColDef[] = [
  {
    headerName: "Tarih",
    ...DATE_COLUMN,
    field: "entryDate",
    width: 120,
    pinned: "left",
  },
  {
    headerName: "Hesap Kodu",
    field: "accountCode",
    width: 120,
    filter: "agTextColumnFilter",
    pinned: "left",
  },
  {
    headerName: "Hesap Adı",
    field: "accountName",
    flex: 1,
    minWidth: 200,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "Borç",
    ...TRY_COLUMN,
    field: "debitAmount",
    width: 150,
  },
  {
    headerName: "Alacak",
    ...TRY_COLUMN,
    field: "creditAmount",
    width: 150,
  },
  {
    headerName: "Açıklama",
    field: "lineDescription",
    flex: 1,
    minWidth: 180,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "Kaynak",
    field: "sourceType",
    width: 100,
    filter: "agTextColumnFilter",
    valueFormatter: (p) => {
      const map: Record<string, string> = {
        manual: "Manuel",
        invoice: "Fatura",
        payment: "Ödeme",
        import: "İçe Aktarım",
      };
      return map[p.value as string] ?? (p.value as string);
    },
  },
];

export interface JournalEntryGridProps {
  /** Row data to display */
  rows: JournalEntryRow[];
  /** Whether data is loading */
  loading?: boolean;
  /** Optional CSS height for the grid. Defaults to 600px. */
  height?: string;
}

/**
 * JournalEntryGrid — Yevmiye Defteri viewer.
 *
 * Renders journal entry lines in an AG Grid with:
 *   - Turkish locale formatting
 *   - Currency columns for borç/alacak
 *   - BalanceIndicator showing debit/credit totals from visible rows
 */
export function JournalEntryGrid({
  rows,
  loading = false,
  height = "600px",
}: JournalEntryGridProps) {
  const gridApiRef = useRef<GridApi<JournalEntryRow> | null>(null);
  const [debitTotal, setDebitTotal] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);

  /** Recompute totals from currently visible (post-filter) rows. */
  const recomputeTotals = useCallback(() => {
    const api = gridApiRef.current;
    if (!api) return;

    let debits = 0;
    let credits = 0;

    api.forEachNodeAfterFilter((node) => {
      if (node.data) {
        debits += node.data.debitAmount || 0;
        credits += node.data.creditAmount || 0;
      }
    });

    setDebitTotal(debits);
    setCreditTotal(credits);
  }, []);

  const handleGridReady = useCallback(
    (event: { api: GridApi<JournalEntryRow> }) => {
      gridApiRef.current = event.api;
      recomputeTotals();
    },
    [recomputeTotals]
  );

  const handleFilterChanged = useCallback(
    (_event: FilterChangedEvent<JournalEntryRow>) => {
      recomputeTotals();
    },
    [recomputeTotals]
  );

  // Recompute when row data changes
  const columnDefs = useMemo(() => JOURNAL_COLUMNS, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Balance indicator bar */}
      <BalanceIndicator debitTotal={debitTotal} creditTotal={creditTotal} />

      {/* AG Grid */}
      <BaseGrid<JournalEntryRow>
        rowData={rows}
        columnDefs={columnDefs}
        height={height}
        loading={loading}
        onGridReady={handleGridReady}
        onFilterChanged={handleFilterChanged}
        onRowDataUpdated={recomputeTotals}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
