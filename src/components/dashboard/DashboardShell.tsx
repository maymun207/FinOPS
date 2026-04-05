"use client";

/**
 * DashboardShell — Main dashboard layout with KPI row.
 *
 * Renders the operational dashboard the accountant sees daily:
 *   - Current fiscal period indicator
 *   - KPI card row (revenue, expenses, net income, receivables, payables)
 *   - Slot for additional content below
 */
import React from "react";
import { KPICard, computeDeltaPercent } from "./KPICard";

export interface DashboardKPIs {
  revenue: string;
  revenueCount: number;
  expenses: string;
  expenseCount: number;
  netIncome: string;
  receivables: string;
  payables: string;
  contactCount: number;
  journalLineCount: number;
  currentPeriod: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
}

export interface DashboardShellProps {
  kpis: DashboardKPIs | undefined;
  isLoading: boolean;
  children?: React.ReactNode;
}

export function DashboardShell({ kpis, isLoading, children }: DashboardShellProps) {
  // Compute a simple delta for net income (positive = profit, negative = loss)
  const netIncome = kpis ? parseFloat(kpis.netIncome) : 0;
  const revenue = kpis ? parseFloat(kpis.revenue) : 0;
  // Net income as % of revenue gives a margin-like delta
  const netDelta = revenue > 0 ? (netIncome / revenue) * 100 : 0;

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#e2e8f0",
              margin: 0,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Operasyonel Pano
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.875rem",
              margin: "0.25rem 0 0 0",
            }}
          >
            Günlük mali durumunuza genel bakış
          </p>
        </div>

        {/* Fiscal Period Badge */}
        {kpis?.currentPeriod ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
              }}
            />
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
              Aktif Dönem:
            </span>
            <span
              style={{
                color: "#e2e8f0",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {kpis.currentPeriod.name}
            </span>
          </div>
        ) : (
          <div
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              fontSize: "0.8125rem",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            ⚠ Aktif dönem yok
          </div>
        )}
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                height: "120px",
                borderRadius: "0.75rem",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : kpis ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <KPICard
            title="Gelir"
            value={kpis.revenue}
            icon="📈"
            deltaLabel={`${kpis.revenueCount} fatura`}
          />
          <KPICard
            title="Gider"
            value={kpis.expenses}
            icon="📉"
            deltaLabel={`${kpis.expenseCount} fatura`}
          />
          <KPICard
            title="Net Kâr/Zarar"
            value={kpis.netIncome}
            icon={netIncome > 0 ? "✅" : netIncome < 0 ? "🔻" : "➖"}
            delta={netDelta}
            deltaLabel="kâr marjı"
          />
          <KPICard
            title="Alacaklar"
            value={kpis.receivables}
            icon="💰"
          />
          <KPICard
            title="Borçlar"
            value={kpis.payables}
            icon="💳"
          />
        </div>
      ) : null}

      {/* ── Stats Row ───────────────────────────────────────────── */}
      {kpis && (
        <div
          style={{
            display: "flex",
            gap: "2rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Cari Kartlar:</span>
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.875rem" }}>
              {kpis.contactCount}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Yevmiye Satırı:</span>
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.875rem" }}>
              {kpis.journalLineCount}
            </span>
          </div>
        </div>
      )}

      {/* ── Additional Content Slot ─────────────────────────────── */}
      {children}
    </div>
  );
}
