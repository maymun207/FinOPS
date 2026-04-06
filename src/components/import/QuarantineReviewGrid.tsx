"use client";

/**
 * QuarantineReviewGrid — AG Grid for reviewing quarantined import records.
 *
 * Features:
 *   - Inline editing of cell values (rawData fields)
 *   - Row selection for bulk approve/reject
 *   - Status badge column
 *   - Approve / Reject action buttons per row
 *   - Bulk action toolbar
 */
import React, { useMemo, useCallback, useRef, useState } from "react";
import type {
  ColDef,
  GridReadyEvent,
  GridApi,
  SelectionChangedEvent,
  CellClickedEvent,
} from "ag-grid-community";
import { BaseGrid } from "../grids/BaseGrid";
import { trpc } from "@/lib/trpc/client";

interface QuarantineRecord {
  id: string;
  source: string;
  rawData: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: Date | string;
}

interface QuarantineReviewGridProps {
  statusFilter?: "pending" | "approved" | "rejected";
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "rgba(234, 179, 8, 0.15)", color: "#eab308", label: "Bekliyor" },
  approved: { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e", label: "Onaylandı" },
  rejected: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", label: "Reddedildi" },
};

export function QuarantineReviewGrid({
  statusFilter = "pending",
}: QuarantineReviewGridProps) {
  const gridApiRef = useRef<GridApi | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Fetch quarantine data
  const {
    data,
    refetch,
    isLoading,
  } = trpc.quarantine.list.useQuery({
    status: statusFilter,
    limit: 500,
    offset: 0,
  });

  // Mutations
  const approveMutation = trpc.quarantine.approve.useMutation({
    onSuccess: () => { void refetch(); },
  });
  const rejectMutation = trpc.quarantine.reject.useMutation({
    onSuccess: () => { void refetch(); },
  });
  const bulkApproveMutation = trpc.quarantine.bulkApprove.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      void refetch();
    },
  });
  const bulkRejectMutation = trpc.quarantine.bulkReject.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      setShowRejectDialog(false);
      void refetch();
    },
  });
  const updateMutation = trpc.quarantine.update.useMutation({
    onSuccess: () => { void refetch(); },
  });

  // Dynamically build columns from rawData keys
  const columnDefs = useMemo<ColDef<QuarantineRecord>[]>(() => {
    const firstRow = data?.rows[0];
    const rawDataKeys = firstRow?.rawData
      ? Object.keys(firstRow.rawData as Record<string, unknown>)
      : [];

    const dynamicCols: ColDef<QuarantineRecord>[] = rawDataKeys.map((key) => ({
      headerName: key,
      valueGetter: (params: { data?: QuarantineRecord }) => {
        const rd = params.data?.rawData;
        return rd?.[key] ?? "";
      },
      valueSetter: (params: {
        data: QuarantineRecord;
        newValue: unknown;
        colDef: ColDef;
      }) => {
        const rd = { ...(params.data.rawData) };
        rd[key] = params.newValue;
        params.data.rawData = rd;
        // Trigger server update
        updateMutation.mutate({
          id: params.data.id,
          rawData: rd,
        });
        return true;
      },
      editable: statusFilter === "pending",
      flex: 1,
      minWidth: 120,
    }));

    return [
      // Status badge
      {
        headerName: "Durum",
        field: "status",
        width: 110,
        editable: false,
        cellRenderer: (params: { value: string }) => {
          const style = STATUS_STYLES[params.value] ?? STATUS_STYLES.pending!;
          return `<span style="
            display:inline-block;
            padding:2px 10px;
            border-radius:9999px;
            font-size:12px;
            font-weight:600;
            background:${style.bg};
            color:${style.color};
          ">${style.label}</span>`;
        },
      },
      // Dynamic rawData columns
      ...dynamicCols,
      // Error message
      {
        headerName: "Hata",
        field: "errorMessage",
        width: 200,
        editable: false,
        cellStyle: { color: "#ef4444", fontSize: "12px" },
      },
      // Actions (only for pending)
      ...(statusFilter === "pending"
        ? [
            {
              headerName: "İşlem",
              width: 180,
              editable: false as const,
              pinned: "right" as const,
              cellRenderer: (params: { data: QuarantineRecord }) => {
                // params.data is always defined in cellRenderer
                return `<div style="display:flex;gap:6px;padding-top:4px">
                  <button
                    data-action="approve"
                    data-id="${params.data.id}"
                    style="padding:4px 12px;border-radius:6px;border:1px solid rgba(34,197,94,0.5);background:rgba(34,197,94,0.15);color:#22c55e;cursor:pointer;font-size:12px"
                  >✓ Onayla</button>
                  <button
                    data-action="reject"
                    data-id="${params.data.id}"
                    style="padding:4px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.5);background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;font-size:12px"
                  >✕ Reddet</button>
                </div>`;
              },
            },
          ]
        : []),
    ];
  }, [data?.rows, statusFilter, updateMutation]);

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
  }, []);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent) => {
      const selected = event.api.getSelectedRows() as QuarantineRecord[];
      setSelectedIds(selected.map((r) => r.id));
    },
    []
  );

  const handleCellClicked = useCallback(
    (event: CellClickedEvent<QuarantineRecord>) => {
      const target = (event.event as MouseEvent | undefined)?.target as HTMLElement | null;
      if (!target || !event.data) return;

      const action = target.getAttribute("data-action");
      const id = target.getAttribute("data-id");
      if (!action || !id) return;

      if (action === "approve") {
        approveMutation.mutate({ id });
      } else if (action === "reject") {
        const reason = prompt("Red nedeni:");
        if (reason) {
          rejectMutation.mutate({ id, reason });
        }
      }
    },
    [approveMutation, rejectMutation]
  );

  const rows = data?.rows ?? [];

  return (
    <div>
      {/* Bulk action toolbar */}
      {selectedIds.length > 0 && statusFilter === "pending" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            marginBottom: "12px",
            borderRadius: "8px",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            fontSize: "14px",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {selectedIds.length} satır seçildi
          </span>

          <button
            onClick={() => { bulkApproveMutation.mutate({ ids: selectedIds }); }}
            disabled={bulkApproveMutation.isPending}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(34, 197, 94, 0.5)",
              background: "rgba(34, 197, 94, 0.15)",
              color: "#22c55e",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            ✓ Tümünü Onayla
          </button>

          <button
            onClick={() => { setShowRejectDialog(true); }}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            ✕ Tümünü Reddet
          </button>
        </div>
      )}

      {/* Reject reason dialog */}
      {showRejectDialog && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            marginBottom: "12px",
            borderRadius: "8px",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => { setRejectReason(e.target.value); }}
            placeholder="Red nedeni..."
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, #3f3f46)",
              backgroundColor: "var(--bg-secondary, #27272a)",
              color: "inherit",
              fontSize: "14px",
            }}
          />
          <button
            onClick={() => {
              if (rejectReason.trim()) {
                bulkRejectMutation.mutate({
                  ids: selectedIds,
                  reason: rejectReason.trim(),
                });
              }
            }}
            disabled={!rejectReason.trim() || bulkRejectMutation.isPending}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Reddet
          </button>
          <button
            onClick={() => {
              setShowRejectDialog(false);
              setRejectReason("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.6,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid */}
      <div style={{ height: 500 }}>
        <BaseGrid<QuarantineRecord>
          rowData={rows as QuarantineRecord[]}
          columnDefs={columnDefs}
          loading={isLoading}
          onGridReady={handleGridReady}
          onSelectionChanged={handleSelectionChanged}
          onCellClicked={handleCellClicked}
          rowSelection="multiple"
          pagination={false}
          getRowId={(params) => params.data.id}
        />
      </div>

      {/* Summary */}
      <div style={{ marginTop: "8px", fontSize: "13px", opacity: 0.6 }}>
        Toplam: {data?.total ?? 0} kayıt
      </div>
    </div>
  );
}
