"use client";
/**
 * Reports Hub Page — Dashboard reports overview.
 *
 * Displays 5 ECharts operational charts in a responsive grid
 * with Download PDF and Download Excel buttons that trigger reports.
 *
 * Data sourced from cached DuckDB reports via tRPC.
 */
import React, { useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import dynamic from "next/dynamic";

// Dynamic imports with ssr: false — ECharts uses canvas APIs
const CashFlowWaterfall = dynamic(() => import("@/components/charts/CashFlowWaterfall"), { ssr: false });
const ReceivablesAging = dynamic(() => import("@/components/charts/ReceivablesAging"), { ssr: false });
const KDVByRate = dynamic(() => import("@/components/charts/KDVByRate"), { ssr: false });
const ExpenseTreemap = dynamic(() => import("@/components/charts/ExpenseTreemap"), { ssr: false });
const RevenueExpenseTrend = dynamic(() => import("@/components/charts/RevenueExpenseTrend"), { ssr: false });

// ── Download Buttons ───────────────────────────────────────────────

type ReportType = "trial_balance" | "balance_sheet" | "income_statement" | "kdv_summary";

function DownloadButton({
  label,
  icon,
  onClick,
  variant = "primary",
}: {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const bg = variant === "primary" ? "#1B2B4B" : "#fff";
  const color = variant === "primary" ? "#fff" : "#1B2B4B";
  const border = variant === "secondary" ? "1px solid #1B2B4B" : "none";

  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        background: bg,
        color,
        border,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function ReportDownloadRow({
  title,
  reportType,
}: {
  title: string;
  reportType: ReportType;
}) {
  const triggerJob = trpc.job.triggerReport.useMutation();

  const handleDownload = useCallback(
    (format: "xlsx" | "pdf") => {
      triggerJob.mutate({
        reportType,
        format,
        fiscalPeriodId: "00000000-0000-0000-0000-000000000000", // placeholder — will use current period
      });
    },
    [triggerJob, reportType],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{title}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <DownloadButton label="Excel" icon="📊" onClick={() => { handleDownload("xlsx"); }} variant="secondary" />
        <DownloadButton label="PDF" icon="📄" onClick={() => { handleDownload("pdf"); }} />
      </div>
    </div>
  );
}

// ── Chart Card ─────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        padding: 24,
        border: "1px solid #e5e7eb",
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#1B2B4B",
          marginBottom: 16,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const cashflow = trpc.report.monthlyCashflow.useQuery();
  const aging = trpc.report.agingReceivables.useQuery();
  const kdv = trpc.report.kdvSummary.useQuery();
  const income = trpc.report.incomeStatement.useQuery();

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1B2B4B",
            marginBottom: 4,
          }}
        >
          Raporlar
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Finansal performans göstergeleri ve analitik raporlar
        </p>
      </div>

      {/* Download Section */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: 24,
          border: "1px solid #e5e7eb",
          marginBottom: 24,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1B2B4B",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Rapor İndir
        </h3>
        <ReportDownloadRow title="Mizan (Deneme Bakiyesi)" reportType="trial_balance" />
        <ReportDownloadRow title="Bilanço" reportType="balance_sheet" />
        <ReportDownloadRow title="Gelir Tablosu" reportType="income_statement" />
        <ReportDownloadRow title="KDV Beyanname Özeti" reportType="kdv_summary" />
      </div>

      {/* Charts Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
          gap: 24,
        }}
      >
        {/* Row 1: Trend + Cashflow */}
        <ChartCard title="Gelir / Gider Trendi">
          <RevenueExpenseTrend
            data={(cashflow.data as {
              year: number;
              month: number;
              cash_in: number;
              cash_out: number;
              net_flow: number;
            }[] | null) ?? []}
            height={350}
          />
        </ChartCard>

        <ChartCard title="Aylık Nakit Akışı">
          <CashFlowWaterfall
            data={(cashflow.data as {
              year: number;
              month: number;
              cash_in: number;
              cash_out: number;
              net_flow: number;
            }[] | null) ?? []}
            height={350}
          />
        </ChartCard>

        {/* Row 2: Aging + KDV */}
        <ChartCard title="Alacak Yaşlandırma">
          <ReceivablesAging
            data={(aging.data as {
              contact_id: string;
              contact_name: string | null;
              bucket_0_30: number;
              bucket_31_60: number;
              bucket_61_90: number;
              bucket_90_plus: number;
              total_receivable: number;
            }[] | null) ?? []}
            height={350}
          />
        </ChartCard>

        <ChartCard title="KDV Oranlarına Göre Dağılım">
          <KDVByRate
            data={(kdv.data as {
              kdv_rate: number;
              invoice_count: number;
              total_subtotal: number;
              total_kdv: number;
              total_grand: number;
            }[] | null) ?? []}
            height={350}
          />
        </ChartCard>

        {/* Row 3: Expense Treemap (full width) */}
        <div style={{ gridColumn: "1 / -1" }}>
          <ChartCard title="Gider Dağılımı (TDHP Grupları)">
            <ExpenseTreemap
              data={
                ((income.data as {
                  account_type: string;
                  account_code: string;
                  account_name: string | null;
                  net_amount: number;
                }[] | null) ?? []).filter((r) => r.account_type === "expense")
              }
              height={450}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
