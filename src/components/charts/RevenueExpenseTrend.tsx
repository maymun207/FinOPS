"use client";
/**
 * RevenueExpenseTrend — ECharts line chart for multi-period trend.
 *
 * Shows monthly revenue vs expense over the fiscal period
 * with area fill to highlight the gap (profit/loss).
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface TrendData {
  year: number;
  month: number;
  cash_in: number;   // used as revenue proxy
  cash_out: number;  // used as expense proxy
  net_flow: number;
}

const MONTH_NAMES = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

interface Props {
  data: TrendData[];
  height?: number;
}

export default function RevenueExpenseTrend({ data, height = 400 }: Props) {
  const option = useMemo(() => {
    const labels = data.map((d) => `${MONTH_NAMES[d.month - 1]} ${d.year}`);

    return {
      tooltip: {
        trigger: "axis" as const,
        formatter: (params: Array<{ seriesName: string; value: number; axisValueLabel: string }>) => {
          let html = `<strong>${params[0]?.axisValueLabel}</strong><br/>`;
          for (const p of params) {
            html += `${p.seriesName}: ₺${p.value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}<br/>`;
          }
          return html;
        },
      },
      legend: { data: ["Gelir", "Gider", "Net Kâr/Zarar"], bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: { type: "category" as const, data: labels, boundaryGap: false },
      yAxis: {
        type: "value" as const,
        axisLabel: { formatter: (v: number) => `₺${(v / 1000).toFixed(0)}K` },
      },
      series: [
        {
          name: "Gelir",
          type: "line" as const,
          data: data.map((d) => Number(d.cash_in)),
          itemStyle: { color: "#22c55e" },
          areaStyle: { color: "rgba(34, 197, 94, 0.1)" },
          smooth: true,
        },
        {
          name: "Gider",
          type: "line" as const,
          data: data.map((d) => Number(d.cash_out)),
          itemStyle: { color: "#ef4444" },
          areaStyle: { color: "rgba(239, 68, 68, 0.1)" },
          smooth: true,
        },
        {
          name: "Net Kâr/Zarar",
          type: "line" as const,
          data: data.map((d) => Number(d.net_flow)),
          itemStyle: { color: "#3b82f6" },
          lineStyle: { width: 3, type: "dashed" as const },
          smooth: true,
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Trend verisi bulunamadı</div>;
  }

  return <ReactECharts option={option} style={{ height }} />;
}
