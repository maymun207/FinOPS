/**
 * FiscalPeriodManager — Period list with open/close/create controls.
 */
"use client";
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid #334155",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  fontSize: "0.875rem",
  fontFamily: "Inter, system-ui, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.375rem",
  fontFamily: "Inter, system-ui, sans-serif",
};

export function FiscalPeriodManager() {
  const [closeTarget, setCloseTarget] = useState<FiscalPeriod | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  const utils = trpc.useUtils();

  const { data: periods, isLoading } = trpc.fiscalPeriod.list.useQuery();

  const createMutation = trpc.fiscalPeriod.create.useMutation({
    onSuccess: () => {
      void utils.fiscalPeriod.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", startDate: "", endDate: "" });
    },
  });

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

  const handleCreate = () => {
    if (!form.name || !form.startDate || !form.endDate) return;
    createMutation.mutate(form);
  };

  const handleCloseConfirm = (periodId: string, confirmation: string) => {
    closeMutation.mutate({ periodId, confirmation });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {[...Array<undefined>(3)].map((_, i) => (
          <div
            key={i}
            style={{
              height: "72px",
              borderRadius: "0.75rem",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header with create button */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => { setShowCreate(!showCreate); }}
          style={{
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            border: "none",
            backgroundColor: "#3b82f6",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {showCreate ? "İptal" : "+ Yeni Dönem"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "#1e293b",
            border: "1px solid #1e40af40",
            marginBottom: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1rem",
            }}
          >
            <div>
              <label style={labelStyle}>Dönem Adı</label>
              <input
                style={inputStyle}
                placeholder="2026 Mali Yılı"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); }}
              />
            </div>
            <div>
              <label style={labelStyle}>Başlangıç Tarihi</label>
              <input
                type="date"
                style={inputStyle}
                value={form.startDate}
                onChange={(e) => { setForm((f) => ({ ...f, startDate: e.target.value })); }}
              />
            </div>
            <div>
              <label style={labelStyle}>Bitiş Tarihi</label>
              <input
                type="date"
                style={inputStyle}
                value={form.endDate}
                onChange={(e) => { setForm((f) => ({ ...f, endDate: e.target.value })); }}
              />
            </div>
          </div>

          {createMutation.error && (
            <div style={{ color: "#ef4444", fontSize: "0.8125rem" }}>
              {createMutation.error.message}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending || !form.name || !form.startDate || !form.endDate}
              style={{
                padding: "0.625rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor:
                  !form.name || !form.startDate || !form.endDate
                    ? "#334155"
                    : "#22c55e",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor:
                  !form.name || !form.startDate || !form.endDate
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              {createMutation.isPending ? "Kaydediliyor..." : "Dönem Oluştur"}
            </button>
          </div>
        </div>
      )}

      {/* Period list */}
      {!periods || periods.length === 0 ? (
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
                  <div style={{ color: "#e2e8f0", fontSize: "0.9375rem", fontWeight: 600 }}>
                    {period.name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                    {period.startDate} — {period.endDate}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                    border: `1px solid ${period.isClosed
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
                    }}
                  >
                    Dönemi Kapat
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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