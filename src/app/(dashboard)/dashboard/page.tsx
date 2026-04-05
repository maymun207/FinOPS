"use client";

/**
 * Dashboard home page — the accountant's daily operational view.
 *
 * Renders the DashboardShell with KPI cards populated from
 * the dashboard.getKPIs tRPC query.
 */
import React from "react";
import { trpc } from "@/lib/trpc/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardPage() {
  const { data: kpis, isLoading } = trpc.dashboard.getKPIs.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchInterval: 60_000, // Refresh every 60s
    }
  );

  return (
    <DashboardShell kpis={kpis} isLoading={isLoading}>
      {/* Additional widgets (recent transactions, alerts, etc.) go here */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1rem",
          marginTop: "0.5rem",
        }}
      >
        {/* Recent Activity Card */}
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <h3
            style={{
              color: "#94a3b8",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 1rem 0",
            }}
          >
            Hızlı Erişim
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { label: "Yeni Fatura", href: "/invoices/new", icon: "📄" },
              { label: "Cari Kartlar", href: "/contacts", icon: "👥" },
              { label: "Yevmiye Defteri", href: "/ledger", icon: "📒" },
              { label: "Dönem Ayarları", href: "/settings/periods", icon: "⚙️" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  color: "#e2e8f0",
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  transition: "background-color 0.2s",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#334155")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Period Status Card */}
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <h3
            style={{
              color: "#94a3b8",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 1rem 0",
            }}
          >
            Dönem Durumu
          </h3>
          {kpis?.currentPeriod ? (
            <div>
              <div
                style={{
                  color: "#e2e8f0",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  marginBottom: "0.375rem",
                }}
              >
                {kpis.currentPeriod.name}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.8125rem" }}>
                {kpis.currentPeriod.startDate} — {kpis.currentPeriod.endDate}
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
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
                <span
                  style={{
                    color: "#22c55e",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Açık
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: "#ef4444", fontSize: "0.875rem" }}>
              Aktif dönem bulunamadı
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
