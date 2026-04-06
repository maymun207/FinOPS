"use client";

/**
 * ColumnMappingGrid — AG Grid for mapping source Excel columns to target fields.
 *
 * Two columns:
 *   - Source Column (read-only): column name from the uploaded file
 *   - Maps To (dropdown): target field for the selected import type
 *
 * Each row represents one Excel column. The 'Maps To' dropdown lists
 * all valid target fields for the selected import type (invoice, contact, journal).
 */
import React, { useMemo, useCallback, useState } from "react";
import type { ColDef, CellValueChangedEvent } from "ag-grid-community";
import { BaseGrid } from "../grids/BaseGrid";

// ── Target field definitions per import type ───────────────────────

const INVOICE_FIELDS = [
  { value: "", label: "— Eşleştirme Yok —" },
  { value: "invoiceNumber", label: "Fatura No" },
  { value: "invoiceDate", label: "Fatura Tarihi" },
  { value: "dueDate", label: "Vade Tarihi" },
  { value: "direction", label: "Yön (Alış/Satış)" },
  { value: "contactName", label: "Cari Adı" },
  { value: "subtotal", label: "Ara Toplam" },
  { value: "kdvRate", label: "KDV Oranı" },
  { value: "kdvTotal", label: "KDV Tutarı" },
  { value: "grandTotal", label: "Genel Toplam" },
  { value: "currency", label: "Para Birimi" },
  { value: "description", label: "Açıklama" },
];

const CONTACT_FIELDS = [
  { value: "", label: "— Eşleştirme Yok —" },
  { value: "name", label: "Cari Adı" },
  { value: "type", label: "Cari Türü" },
  { value: "taxId", label: "VKN / TC" },
  { value: "email", label: "E-posta" },
  { value: "phone", label: "Telefon" },
  { value: "address", label: "Adres" },
];

const JOURNAL_FIELDS = [
  { value: "", label: "— Eşleştirme Yok —" },
  { value: "date", label: "Tarih" },
  { value: "description", label: "Açıklama" },
  { value: "accountCode", label: "Hesap Kodu" },
  { value: "debit", label: "Borç" },
  { value: "credit", label: "Alacak" },
  { value: "reference", label: "Referans" },
];

const FIELD_MAP: Record<string, typeof INVOICE_FIELDS> = {
  invoice: INVOICE_FIELDS,
  contact: CONTACT_FIELDS,
  journal: JOURNAL_FIELDS,
};

export interface MappingRow {
  sourceCol: string;
  targetField: string;
}

interface ColumnMappingGridProps {
  sourceColumns: string[];
  importType: "invoice" | "contact" | "journal";
  initialMapping?: MappingRow[];
  onChange: (mapping: MappingRow[]) => void;
}

export function ColumnMappingGrid({
  sourceColumns,
  importType,
  initialMapping,
  onChange,
}: ColumnMappingGridProps) {
  const targetFields = FIELD_MAP[importType] ?? INVOICE_FIELDS;

  // Build initial row data: one row per source column
  const [rowData] = useState<MappingRow[]>(() => {
    if (initialMapping && initialMapping.length > 0) {
      return initialMapping;
    }
    // Auto-match: try to find target field by matching names
    return sourceColumns.map((col) => ({
      sourceCol: col,
      targetField: autoMatch(col, targetFields),
    }));
  });

  const columnDefs = useMemo<ColDef<MappingRow>[]>(
    () => [
      {
        headerName: "Kaynak Sütun (Excel)",
        field: "sourceCol",
        editable: false,
        flex: 1,
        cellStyle: { fontWeight: 600 },
      },
      {
        headerName: "Hedef Alan",
        field: "targetField",
        editable: true,
        flex: 1,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: targetFields.map((f) => f.value),
        },
        valueFormatter: (params: { value: string }) => {
          const field = targetFields.find((f) => f.value === params.value);
          return field?.label ?? params.value;
        },
      },
    ],
    [targetFields]
  );

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<MappingRow>) => {
      // Collect all current mappings from grid data
      const api = event.api;
      const mappings: MappingRow[] = [];
      api.forEachNode((node) => {
        if (node.data) {
          mappings.push({
            sourceCol: node.data.sourceCol,
            targetField: node.data.targetField,
          });
        }
      });
      onChange(mappings);
    },
    [onChange]
  );

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
          Sütun Eşleştirme
        </h3>
        <p style={{ fontSize: "13px", opacity: 0.6, margin: "4px 0 0" }}>
          Her Excel sütununu hedef alana eşleştirin. Eşleştirilmeyen sütunlar atlanacaktır.
        </p>
      </div>

      <div style={{ height: Math.min(400, 48 + sourceColumns.length * 42) }}>
        <BaseGrid<MappingRow>
          rowData={rowData}
          columnDefs={columnDefs}
          onCellValueChanged={handleCellValueChanged}
          pagination={false}
          domLayout={sourceColumns.length <= 8 ? "autoHeight" : undefined}
          singleClickEdit={true}
        />
      </div>
    </div>
  );
}

/**
 * Simple auto-matcher: compares normalized source column name against target labels.
 */
function autoMatch(
  sourceCol: string,
  targets: { value: string; label: string }[]
): string {
  const normalized = sourceCol.trim().toLowerCase().replace(/[_\s-]+/g, "");

  for (const target of targets) {
    if (!target.value) continue;

    const targetNorm = target.label.toLowerCase().replace(/[_\s-]+/g, "");
    const targetValueNorm = target.value.toLowerCase();

    // Exact match on label or field name
    if (normalized === targetNorm || normalized === targetValueNorm) {
      return target.value;
    }

    // Partial match: source contains target or vice versa
    if (normalized.includes(targetNorm) || targetNorm.includes(normalized)) {
      return target.value;
    }
  }

  return ""; // No match
}
