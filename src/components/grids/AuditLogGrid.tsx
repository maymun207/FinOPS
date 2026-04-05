"use client";

/**
 * AuditLogGrid — Read-only AG Grid for the audit trail.
 *
 * Displays the immutable audit_log table with:
 *   - Table name, action (INSERT/UPDATE/DELETE), record ID
 *   - User ID, timestamp
 *   - Expandable old/new data JSON
 *
 * Admin-only component — no edit capabilities.
 */
import React, { useState, useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { trpc } from "@/lib/trpc/client";
import { formatDateTR } from "./grid-types";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

/** Turkish locale overrides for AG Grid */
const TR_LOCALE = {
  noRowsToShow: "Kayıt bulunamadı",
  loadingOos: "Yükleniyor...",
  page: "Sayfa",
  of: "/",
  to: "-",
  next: "Sonraki",
  previous: "Önceki",
  first: "İlk",
  last: "Son",
};

/** Action badge colors */
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  INSERT: { bg: "rgba(34, 197, 94, 0.1)", text: "#22c55e" },
  UPDATE: { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
  DELETE: { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" },
};

interface AuditLogRow {
  id: number;
  tableName: string;
  recordId: string;
  action: string;
  oldData: unknown;
  newData: unknown;
  userId: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

export function AuditLogGrid() {
  const [tableFilter, setTableFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<
    "INSERT" | "UPDATE" | "DELETE" | undefined
  >(undefined);

  const { data, isLoading } = trpc.auditLog.list.useQuery({
    tableName: tableFilter,
    action: actionFilter,
    limit: 500,
  });

  const { data: tableNames } = trpc.auditLog.getTableNames.useQuery();

  const columnDefs = useMemo(
    (): ColDef[] => [
      {
        headerName: "#",
        field: "id",
        width: 80,
        cellClass: "ag-right-aligned-cell",
      } satisfies ColDef,
      {
        headerName: "Tablo",
        field: "tableName",
        width: 140,
        cellStyle: {
          fontFamily: "monospace",
          fontSize: "0.8125rem",
        } as Record<string, string>,
      } satisfies ColDef,
      {
        headerName: "İşlem",
        field: "action",
        width: 100,
        cellRenderer: (params: { value: string }) => {
          const colors = ACTION_COLORS[params.value] ?? {
            bg: "#334155",
            text: "#94a3b8",
          };
          return `<span style="
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.6875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background-color: ${colors.bg};
            color: ${colors.text};
          ">${params.value}</span>`;
        },
      },
      {
        headerName: "Kayıt ID",
        field: "recordId",
        width: 120,
        cellStyle: {
          fontFamily: "monospace",
          fontSize: "0.75rem",
          color: "#94a3b8",
        } as Record<string, string>,
        valueFormatter: (p: ValueFormatterParams) =>
          p.value ? (p.value as string).slice(0, 8) + "…" : "",
      },
      {
        headerName: "Kullanıcı",
        field: "userId",
        width: 140,
        cellStyle: { fontSize: "0.8125rem" } as Record<string, string>,
        valueFormatter: (p: ValueFormatterParams) =>
          p.value ? (p.value as string).slice(0, 12) + "…" : "Sistem",
      },
      {
        headerName: "Tarih",
        field: "createdAt",
        width: 160,
        valueFormatter: (p: ValueFormatterParams) => {
          if (!p.value) return "";
          const d = new Date(p.value as string);
          return `${formatDateTR(d)} ${d.toLocaleTimeString("tr-TR")}`;
        },
      },
      {
        headerName: "Eski Veri",
        field: "oldData",
        flex: 1,
        cellStyle: {
          fontFamily: "monospace",
          fontSize: "0.6875rem",
          color: "#94a3b8",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        } as Record<string, string>,
        valueFormatter: (p: ValueFormatterParams) =>
          p.value ? JSON.stringify(p.value).slice(0, 80) : "—",
      },
      {
        headerName: "Yeni Veri",
        field: "newData",
        flex: 1,
        cellStyle: {
          fontFamily: "monospace",
          fontSize: "0.6875rem",
          color: "#94a3b8",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        } as Record<string, string>,
        valueFormatter: (p: ValueFormatterParams) =>
          p.value ? JSON.stringify(p.value).slice(0, 80) : "—",
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      suppressMovable: true,
    }),
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <select
          value={tableFilter ?? ""}
          onChange={(e) =>
            setTableFilter(e.target.value || undefined)
          }
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid #334155",
            backgroundColor: "#0f172a",
            color: "#e2e8f0",
            fontSize: "0.8125rem",
          }}
        >
          <option value="">Tüm tablolar</option>
          {tableNames?.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={actionFilter ?? ""}
          onChange={(e) =>
            setActionFilter(
              (e.target.value as "INSERT" | "UPDATE" | "DELETE") || undefined
            )
          }
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid #334155",
            backgroundColor: "#0f172a",
            color: "#e2e8f0",
            fontSize: "0.8125rem",
          }}
        >
          <option value="">Tüm işlemler</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        {data && (
          <span
            style={{
              color: "#64748b",
              fontSize: "0.75rem",
              marginLeft: "auto",
            }}
          >
            {data.total} kayıt
          </span>
        )}
      </div>

      {/* Grid */}
      <div
        className="ag-theme-alpine-dark"
        style={{ height: "600px", width: "100%" }}
      >
        <AgGridReact
          rowData={data?.rows ?? []}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          loading={isLoading}
          localeText={TR_LOCALE}
          animateRows={true}
          getRowId={(params) => String(params.data.id)}
          /* Virtual scrolling for large row counts (10K+) */
          rowBuffer={20}
          suppressRowVirtualisation={false}
        />
      </div>
    </div>
  );
}
