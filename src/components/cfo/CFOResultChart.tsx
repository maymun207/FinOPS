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
import { Card, Metric, Text } from "@tremor/react";
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

// ── KPI Card — Tremor Metric ────────────────────────────────────────

function KPICard({ rows }: { rows: Record<string, unknown>[] }) {
  const row = rows[0];
  if (!row) return null;
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
    <Card
      id="cfo-kpi-card"
      className="mx-auto max-w-xs"
      decoration="top"
      decorationColor="blue"
      style={{
        background: "linear-gradient(135deg, #1e293b, #0f172a)",
        border: "1px solid #334155",
        textAlign: "center",
        padding: "32px 24px",
      }}
    >
      <Text style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label.replace(/_/g, " ")}
      </Text>
      <Metric style={{ color: "#60a5fa", fontSize: 36, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
        {formatted}
      </Metric>
    </Card>
  );
}

// ── Line Chart ──────────────────────────────────────────────────────

function buildLineOption(rows: Record<string, unknown>[]) {
  const cols = inferColumns(rows);
  const dateCol = cols.find((c) => c.type === "date");
  if (!dateCol) return {};
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
          Math.abs(v) >= 1000 ? `₺${(v / 1000).toFixed(0)}K` : `₺${v.toFixed(0)}`,
      },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: numCols.map((col, i) => ({
      name: col.name,
      type: "line" as const,
      data: rows.map((r) => Number(r[col.name] ?? 0)),
      smooth: true,
      itemStyle: { color: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"][i % 4] },
      areaStyle: { color: `rgba(${String([59, 130, 246][0])}, 0.08)` },
    })),
  };
}

// ── Bar Chart ───────────────────────────────────────────────────────

function buildBarOption(rows: Record<string, unknown>[]) {
  const cols = inferColumns(rows);
  const catCol = cols.find((c) => c.type === "string") ?? cols[0];
  if (!catCol) return {};
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
          Math.abs(v) >= 1000 ? `₺${(v / 1000).toFixed(0)}K` : `₺${v.toFixed(0)}`,
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
