"use client";

/**
 * FiscalPeriodManager — Period list with open/close controls.
 *
 * Displays all fiscal periods for the company with:
 *   - Status badge (Açık / Kapalı)
 *   - Date range
 *   - Close button (opens ClosePeriodDialog)
 *   - Open button (for re-opening, less dangerous)
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { ClosePeriodDialog } from "./ClosePeriodDialog";

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt: Date | null;
}

export function FiscalPeriodManager() {
  const [closeTarget, setCloseTarget] = useState<FiscalPeriod | null>(null);
  const utils = trpc.useUtils();

  const { data: periods, isLoading } = trpc.fiscalPeriod.list.useQuery();

  const closeMutation = trpc.fiscalPeriod.closePeriod.useMutation({
    onSuccess: () => {
      void utils.fiscalPeriod.list.invalidate();
      setCloseTarget(null);
    },
  });

  const openMutation = trpc.fiscalPeriod.openPeriod.useMutation({
    onSuccess: () => {
      void utils.fiscalPeriod.list.invalidate();
    },
  });

  const handleCloseConfirm = (periodId: string, confirmation: string) => {
    closeMutation.mutate({ periodId, confirmation });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {[...Array<undefined>(3)].map((_, i) => (
          <div
            key={i}
            style={{
              height: "72px",
              borderRadius: "0.75rem",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (!periods || periods.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "#64748b",
          fontSize: "0.875rem",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Henüz mali dönem tanımlanmamış.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {periods.map((period: FiscalPeriod) => (
          <div
            key={period.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderRadius: "0.75rem",
              backgroundColor: "#1e293b",
              border: `1px solid ${period.isClosed ? "#334155" : "#1e40af40"}`,
              transition: "border-color 0.2s",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {/* Period info */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {/* Status dot */}
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: period.isClosed ? "#ef4444" : "#22c55e",
                  flexShrink: 0,
                }}
              />

              <div>
                <div
                  style={{
                    color: "#e2e8f0",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                  }}
                >
                  {period.name}
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "0.75rem",
                    marginTop: "0.125rem",
                  }}
                >
                  {period.startDate} — {period.endDate}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Status badge */}
              <span
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  backgroundColor: period.isClosed
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(34, 197, 94, 0.1)",
                  color: period.isClosed ? "#ef4444" : "#22c55e",
                  border: `1px solid ${
                    period.isClosed
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(34, 197, 94, 0.2)"
                  }`,
                }}
              >
                {period.isClosed ? "Kapalı" : "Açık"}
              </span>

              {period.isClosed ? (
                <button
                  type="button"
                  onClick={() => { openMutation.mutate({ periodId: period.id }); }}
                  disabled={openMutation.isPending}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #334155",
                    backgroundColor: "transparent",
                    color: "#94a3b8",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    fontFamily: "Inter, system-ui, sans-serif",
                    transition: "background-color 0.2s",
                  }}
                >
                  Yeniden Aç
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setCloseTarget(period); }}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "0.375rem",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    backgroundColor: "rgba(239, 68, 68, 0.05)",
                    color: "#ef4444",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "Inter, system-ui, sans-serif",
                    transition: "background-color 0.2s",
                  }}
                >
                  Dönemi Kapat
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Close confirmation dialog */}
      <ClosePeriodDialog
        isOpen={closeTarget !== null}
        periodName={closeTarget?.name ?? ""}
        periodId={closeTarget?.id ?? ""}
        isLoading={closeMutation.isPending}
        onConfirm={handleCloseConfirm}
        onCancel={() => { setCloseTarget(null); }}
      />
    </>
  );
}
