"use client";

/**
 * ContactsGrid — AG Grid list of contacts (Cari Kartlar).
 *
 * Features:
 *   - Turkish locale via BaseGrid
 *   - Columns: name, type, taxId, email, phone
 *   - Row click invokes onRowClick callback for navigation
 */
import React, { useMemo } from "react";
import type { ColDef, RowClickedEvent } from "ag-grid-community";
import { BaseGrid } from "./BaseGrid";

export interface ContactRow {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}

const TYPE_LABELS: Record<string, string> = {
  customer: "Müşteri",
  vendor: "Tedarikçi",
  both: "Her İkisi",
};

const CONTACT_COLUMNS: ColDef[] = [
  {
    headerName: "İsim",
    field: "name",
    flex: 2,
    minWidth: 200,
    filter: "agTextColumnFilter",
    pinned: "left",
  },
  {
    headerName: "Tür",
    field: "type",
    width: 120,
    filter: "agTextColumnFilter",
    valueFormatter: (p) => TYPE_LABELS[p.value as string] ?? (p.value as string),
  },
  {
    headerName: "VKN / TCKN",
    field: "taxId",
    width: 150,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "E-posta",
    field: "email",
    flex: 1,
    minWidth: 180,
    filter: "agTextColumnFilter",
  },
  {
    headerName: "Telefon",
    field: "phone",
    width: 160,
    filter: "agTextColumnFilter",
  },
];

export interface ContactsGridProps {
  rows: ContactRow[];
  loading?: boolean;
  height?: string;
  onRowClick?: (contactId: string) => void;
}

export function ContactsGrid({
  rows,
  loading = false,
  height = "600px",
  onRowClick,
}: ContactsGridProps) {
  const columnDefs = useMemo(() => CONTACT_COLUMNS, []);

  const handleRowClicked = (event: RowClickedEvent<ContactRow>) => {
    if (event.data?.id && onRowClick) {
      onRowClick(event.data.id);
    }
  };

  return (
    <BaseGrid<ContactRow>
      rowData={rows}
      columnDefs={columnDefs}
      height={height}
      loading={loading}
      onRowClicked={handleRowClicked}
      getRowId={(params) => params.data.id}
      rowSelection="single"
    />
  );
}
