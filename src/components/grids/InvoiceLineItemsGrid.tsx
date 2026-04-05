"use client";

/**
 * InvoiceLineItemsGrid — Editable AG Grid for invoice line items with live KDV.
 *
 * Features:
 *   - Inline cell editing for description, quantity, unitPrice, kdvRate
 *   - Live recalculation of subtotal, kdvAmount, total on every edit
 *   - KDV rate dropdown (20%, 10%, 1%, 0%)
 *   - Add/remove row controls
 *   - All computed values use decimal.js via calculateLineItem
 *   - Values stored as strings for Postgres decimal precision
 */
import React, { useCallback, useMemo, useRef } from "react";
import type {
  ColDef,
  CellValueChangedEvent,
  GridApi,
  GridReadyEvent,
} from "ag-grid-community";
import { BaseGrid } from "./BaseGrid";
import { formatTRY } from "./grid-types";
import { calculateLineItem } from "@/lib/finance/kdv";

export interface InvoiceLineRow {
  /** Transient row ID (UUID generated client-side for new rows) */
  rowId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  kdvRate: string;
  subtotal: string;
  kdvAmount: string;
  total: string;
}

/** Creates a blank line item row */
export function createEmptyLine(): InvoiceLineRow {
  return {
    rowId: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
    kdvRate: "20",
    subtotal: "0.00",
    kdvAmount: "0.00",
    total: "0.00",
  };
}

/** Recompute a single row's calculated fields */
function recomputeRow(row: InvoiceLineRow): InvoiceLineRow {
  try {
    const computed = calculateLineItem(row.quantity, row.unitPrice, row.kdvRate);
    return {
      ...row,
      subtotal: computed.subtotal,
      kdvAmount: computed.kdvAmount,
      total: computed.total,
    };
  } catch {
    // If input is invalid (e.g. empty string), keep zeros
    return { ...row, subtotal: "0.00", kdvAmount: "0.00", total: "0.00" };
  }
}

export interface InvoiceLineItemsGridProps {
  /** Current line items */
  rows: InvoiceLineRow[];
  /** Called when any row changes (edit, add, remove) */
  onChange: (rows: InvoiceLineRow[]) => void;
  /** Optional height */
  height?: string;
}

const KDV_RATE_OPTIONS = ["20", "10", "1", "0"];

export function InvoiceLineItemsGrid({
  rows,
  onChange,
  height = "350px",
}: InvoiceLineItemsGridProps) {
  const gridApiRef = useRef<GridApi<InvoiceLineRow> | null>(null);

  const columnDefs = useMemo<ColDef<InvoiceLineRow>[]>(
    () => [
      {
        headerName: "Açıklama",
        field: "description",
        flex: 2,
        minWidth: 200,
        editable: true,
        cellDataType: "text",
      },
      {
        headerName: "Miktar",
        field: "quantity",
        width: 100,
        editable: true,
        cellDataType: "text",
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
      },
      {
        headerName: "Birim Fiyat",
        field: "unitPrice",
        width: 130,
        editable: true,
        cellDataType: "text",
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
      },
      {
        headerName: "KDV %",
        field: "kdvRate",
        width: 100,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: KDV_RATE_OPTIONS },
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
        valueFormatter: (p) => `%${p.value}`,
      },
      {
        headerName: "Tutar",
        field: "subtotal",
        width: 130,
        editable: false,
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
        valueFormatter: (p) => formatTRY(parseFloat(p.value as string)),
      },
      {
        headerName: "KDV",
        field: "kdvAmount",
        width: 120,
        editable: false,
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
        valueFormatter: (p) => formatTRY(parseFloat(p.value as string)),
      },
      {
        headerName: "Toplam",
        field: "total",
        width: 140,
        editable: false,
        cellClass: "ag-right-aligned-cell",
        headerClass: "ag-right-aligned-header",
        type: "rightAligned",
        valueFormatter: (p) => formatTRY(parseFloat(p.value as string)),
      },
    ],
    []
  );

  const handleGridReady = useCallback((event: GridReadyEvent<InvoiceLineRow>) => {
    gridApiRef.current = event.api;
  }, []);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<InvoiceLineRow>) => {
      if (!event.data) return;

      const editableFields = ["quantity", "unitPrice", "kdvRate"];
      const field = event.colDef.field;

      if (field && editableFields.includes(field)) {
        // Recompute this row
        const updated = recomputeRow(event.data);
        const newRows = rows.map((r) =>
          r.rowId === updated.rowId ? updated : r
        );
        onChange(newRows);
      } else if (field === "description") {
        // Just propagate the description change
        const newRows = rows.map((r) =>
          r.rowId === event.data!.rowId ? { ...event.data! } : r
        );
        onChange(newRows);
      }
    },
    [rows, onChange]
  );

  const addRow = () => {
    onChange([...rows, createEmptyLine()]);
  };

  const removeLastRow = () => {
    if (rows.length > 1) {
      onChange(rows.slice(0, -1));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #334155",
            backgroundColor: "#1e293b",
            color: "#3b82f6",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
            transition: "background-color 0.2s",
          }}
        >
          + Kalem Ekle
        </button>
        {rows.length > 1 && (
          <button
            type="button"
            onClick={removeLastRow}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#ef4444",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
              transition: "background-color 0.2s",
            }}
          >
            Son Kalemi Sil
          </button>
        )}
        <span
          style={{
            marginLeft: "auto",
            color: "#64748b",
            fontSize: "0.75rem",
            fontFamily: "monospace",
          }}
        >
          {rows.length} kalem
        </span>
      </div>

      {/* Editable Grid */}
      <BaseGrid<InvoiceLineRow>
        rowData={rows}
        columnDefs={columnDefs}
        height={height}
        onGridReady={handleGridReady}
        onCellValueChanged={handleCellValueChanged}
        getRowId={(params) => params.data.rowId}
        pagination={false}
        singleClickEdit={true}
        stopEditingWhenCellsLoseFocus={true}
      />
    </div>
  );
}
