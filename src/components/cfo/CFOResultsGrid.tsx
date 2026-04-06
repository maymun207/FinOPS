"use client";

/**
 * CFOResultsGrid — AG Grid display for Vanna query results.
 *
 * Features:
 *   - Dynamic column inference from result row keys
 *   - Number columns get TRY currency formatting
 *   - Date columns get Turkish locale
 *   - Wraps BaseGrid for consistent dark theme & Turkish locale
 */
import React, { useMemo } from "react";
import { type ColDef } from "ag-grid-community";
import { BaseGrid } from "@/components/grids/BaseGrid";
import { inferColumns } from "@/lib/cfo/chart-detection";

interface Props {
  rows: Record<string, unknown>[];
  height?: string;
}

// Format TRY currency values
function formatTRY(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

export function CFOResultsGrid({ rows, height = "400px" }: Props) {
  const columnDefs = useMemo<ColDef[]>(() => {
    if (rows.length === 0) return [];

    const columns = inferColumns(rows);

    return columns.map((col) => {
      const def: ColDef = {
        field: col.name,
        headerName: col.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        sortable: true,
        filter: true,
      };

      if (col.type === "numeric") {
        def.type = "numericColumn";
        def.valueFormatter = (params) => {
          if (params.value == null) return "";
          const num = Number(params.value);
          // Large numbers get TRY format, small ones just locale
          if (Math.abs(num) >= 100) {
            return formatTRY(num);
          }
          return new Intl.NumberFormat("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(num);
        };
      }

      if (col.type === "date") {
        def.valueFormatter = (params) => {
          if (!params.value) return "";
          try {
            return new Date(params.value as string).toLocaleDateString("tr-TR");
          } catch {
            return String(params.value);
          }
        };
      }

      return def;
    });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 14,
        }}
      >
        Sonuç bulunamadı
      </div>
    );
  }

  return (
    <div id="cfo-results-grid">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {rows.length} satır • {columnDefs.length} sütun
        </span>
      </div>
      <BaseGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={height}
        paginationPageSize={25}
      />
    </div>
  );
}
