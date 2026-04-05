"use client";

/**
 * BaseGrid — Reusable AG Grid wrapper with Turkish locale + theme.
 *
 * Features:
 *   - Turkish locale text (AG_GRID_LOCALE_TR)
 *   - Quartz dark theme
 *   - Sensible defaults (pagination, auto-size, selection)
 *   - Generic row data typing
 */
import React, { useMemo } from "react";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  themeQuartz,
} from "ag-grid-community";

// Register all community modules once
ModuleRegistry.registerModules([AllCommunityModule]);

// ── Turkish locale overrides ────────────────────────────────────────
const AG_GRID_LOCALE_TR: Record<string, string> = {
  // Pagination
  page: "Sayfa",
  to: "ile",
  of: "/",
  more: "daha",
  next: "Sonraki",
  last: "Son",
  first: "İlk",
  previous: "Önceki",
  loadingOoo: "Yükleniyor...",
  noRowsToShow: "Gösterilecek veri yok",
  // Filter
  filterOoo: "Filtrele...",
  equals: "Eşittir",
  notEqual: "Eşit Değil",
  contains: "İçerir",
  notContains: "İçermez",
  startsWith: "İle Başlar",
  endsWith: "İle Biter",
  lessThan: "Küçüktür",
  greaterThan: "Büyüktür",
  lessThanOrEqual: "Küçük veya Eşittir",
  greaterThanOrEqual: "Büyük veya Eşittir",
  inRange: "Aralıkta",
  blank: "Boş",
  notBlank: "Boş Değil",
  // Selection
  selectAll: "Tümünü Seç",
  searchOoo: "Ara...",
  // Column menu
  pinColumn: "Sütunu Sabitle",
  autosizeThisColumn: "Bu Sütunu Otomatik Boyutla",
  autosizeAllColumns: "Tüm Sütunları Otomatik Boyutla",
  resetColumns: "Sütunları Sıfırla",
  // Copy
  copy: "Kopyala",
  copyWithHeaders: "Başlıklarla Kopyala",
  // Export
  export: "Dışa Aktar",
  csvExport: "CSV İndir",
  excelExport: "Excel İndir",
  // Pinned
  pinLeft: "Sola Sabitle",
  pinRight: "Sağa Sabitle",
  noPin: "Sabitleme Yok",
  // Aggregation
  sum: "Toplam",
  min: "Min",
  max: "Maks",
  avg: "Ort",
  count: "Sayı",
};

// ── Dark theme based on Quartz ──────────────────────────────────────
const finopsDarkTheme = themeQuartz.withParams({
  backgroundColor: "#0f172a",
  foregroundColor: "#e2e8f0",
  headerBackgroundColor: "#1e293b",
  borderColor: "#334155",
  rowHoverColor: "#1e293b80",
  selectedRowBackgroundColor: "#1e40af30",
  oddRowBackgroundColor: "#0f172a",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 600,
});

// ── Default column defs ─────────────────────────────────────────────
const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 80,
};

export interface BaseGridProps<TData = unknown>
  extends Omit<AgGridReactProps<TData>, "theme" | "localeText"> {
  /** Optional CSS height. Defaults to 100%. */
  height?: string;
}

/**
 * BaseGrid — AG Grid Community wrapper with Turkish locale + FinOPS dark theme.
 */
export function BaseGrid<TData = unknown>({
  height = "100%",
  defaultColDef: userDefaultColDef,
  onGridReady,
  ...rest
}: BaseGridProps<TData>) {
  const mergedDefaultColDef = useMemo(
    () => ({ ...DEFAULT_COL_DEF, ...userDefaultColDef }),
    [userDefaultColDef]
  );

  const handleGridReady = (event: GridReadyEvent<TData>) => {
    event.api.sizeColumnsToFit();
    onGridReady?.(event);
  };

  return (
    <div style={{ height, width: "100%" }}>
      <AgGridReact<TData>
        theme={finopsDarkTheme}
        localeText={AG_GRID_LOCALE_TR}
        defaultColDef={mergedDefaultColDef as ColDef<TData>}
        pagination={true}
        paginationPageSize={50}
        paginationPageSizeSelector={[25, 50, 100, 250]}
        animateRows={true}
        suppressCellFocus={true}
        onGridReady={handleGridReady}
        {...rest}
      />
    </div>
  );
}
