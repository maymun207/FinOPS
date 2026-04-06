"use client";

/**
 * CFOResultChart — Auto-detect chart type and render ECharts visualization.
 *
 * Chart type detection rules:
 *   - date/period + numeric → line chart (trend)
 *   - category + numeric → bar chart
 *   - debit/credit columns → grouped bar
 *   - one row, one numeric → KPI card
 *   - >10 rows, no date → table only (no chart rendered)
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  detectChartType,
  inferColumns,
  type ChartType,
} from "@/lib/cfo/chart-detection";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Props {
  rows: Record<string, unknown>[];
  height?: number;
}

// ── KPI Card ────────────────────────────────────────────────────────

function KPICard({ rows }: { rows: Record<string, unknown>[] }) {
  const row = rows[0]!;
  const entries = Object.entries(row);
  const numEntry = entries.find(([, v]) => typeof v === "number");
  if (!numEntry) return null;

  const [label, value] = numEntry;
  const formatted = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value as number);

  return (
    <div
      id="cfo-kpi-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        borderRadius: 12,
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label.replace(/_/g, " ")}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          background: "linear-gradient(135deg, #60a5fa, #34d399)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {formatted}
      </div>
    </div>
  );
}

// ── Line Chart ──────────────────────────────────────────────────────

function buildLineOption(rows: Record<string, unknown>[]) {
  const cols = inferColumns(rows);
  const dateCol = cols.find((c) => c.type === "date")!;
  const numCols = cols.filter((c) => c.type === "numeric");

  return {
    tooltip: { trigger: "axis" as const },
    legend: { data: numCols.map((c) => c.name), bottom: 0, textStyle: { color: "#94a3b8" } },
    grid: { left: "3%", right: "4%", bottom: "15%", top: "8%", containLabel: true },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => String(r[dateCol.name])),
      axisLabel: { color: "#64748b", fontSize: 11 },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#64748b",
        formatter: (v: number) =>
          Math.abs(v) >= 1000 ? `₺${(v / 1000).toFixed(0)}K` : `₺${v}`,
      },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: numCols.map((col, i) => ({
      name: col.name,
      type: "line" as const,
      data: rows.map((r) => Number(r[col.name] ?? 0)),
      smooth: true,
      itemStyle: { color: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"][i % 4] },
      areaStyle: { color: `rgba(${[59, 130, 246][0]}, 0.08)` },
    })),
  };
}

// ── Bar Chart ───────────────────────────────────────────────────────

function buildBarOption(rows: Record<string, unknown>[]) {
  const cols = inferColumns(rows);
  const catCol = cols.find((c) => c.type === "string") ?? cols[0]!;
  const numCols = cols.filter((c) => c.type === "numeric");

  return {
    tooltip: { trigger: "axis" as const },
    legend: numCols.length > 1 ? { data: numCols.map((c) => c.name), bottom: 0, textStyle: { color: "#94a3b8" } } : undefined,
    grid: { left: "3%", right: "4%", bottom: numCols.length > 1 ? "15%" : "5%", top: "8%", containLabel: true },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => String(r[catCol.name])),
      axisLabel: { color: "#64748b", fontSize: 11, rotate: rows.length > 5 ? 30 : 0 },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: "#64748b",
        formatter: (v: number) =>
          Math.abs(v) >= 1000 ? `₺${(v / 1000).toFixed(0)}K` : `₺${v}`,
      },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: numCols.map((col, i) => ({
      name: col.name,
      type: "bar" as const,
      data: rows.map((r) => Number(r[col.name] ?? 0)),
      itemStyle: {
        color: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"][i % 4],
        borderRadius: [4, 4, 0, 0],
      },
    })),
  };
}

// ── Grouped Bar (debit/credit) ──────────────────────────────────────

function buildGroupedBarOption(rows: Record<string, unknown>[]) {
  // Same as bar but we force side-by-side
  return buildBarOption(rows);
}

// ── Main Component ──────────────────────────────────────────────────

const CHART_BUILDERS: Record<
  Exclude<ChartType, "kpi" | "table_only">,
  (rows: Record<string, unknown>[]) => Record<string, unknown>
> = {
  line: buildLineOption,
  bar: buildBarOption,
  grouped_bar: buildGroupedBarOption,
};

export function CFOResultChart({ rows, height = 350 }: Props) {
  const chartType = useMemo(() => detectChartType(rows), [rows]);

  const option = useMemo(() => {
    if (chartType === "kpi" || chartType === "table_only") return null;
    const builder = CHART_BUILDERS[chartType];
    return builder(rows);
  }, [rows, chartType]);

  if (chartType === "table_only") return null;
  if (chartType === "kpi") return <KPICard rows={rows} />;
  if (!option) return null;

  return (
    <div id="cfo-result-chart" style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>📊</span>
        <span>
          {chartType === "line"
            ? "Trend Grafiği"
            : chartType === "grouped_bar"
              ? "Karşılaştırmalı Grafik"
              : "Dağılım Grafiği"}
        </span>
      </div>
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
