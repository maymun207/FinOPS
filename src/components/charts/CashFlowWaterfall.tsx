"use client";
/**
 * CashFlowWaterfall — ECharts waterfall chart for monthly cash flow.
 *
 * Uses the ECharts-specific 'transparent' series pattern:
 *   - Helper bar (invisible base) = previous cumulative total
 *   - Positive bars (green) = cash inflows
 *   - Negative bars (red) = cash outflows (value is negative)
 *
 * Data sourced from cached monthlyCashflow report.
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface CashFlowData {
  year: number;
  month: number;
  cash_in: number;
  cash_out: number;
  net_flow: number;
}

const MONTH_NAMES = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/**
 * Transform raw cashflow data into ECharts waterfall series.
 *
 * Returns:
 *   - labels: month-year strings
 *   - helper: invisible base bars (previous cumulative total, opacity: 0)
 *   - positive: inflow values (green)
 *   - negative: outflow values (negative numbers, red)
 *   - netFlow: line overlay for net position
 */
export function transformCashFlowData(data: CashFlowData[]) {
  const labels = data.map((d) => `${MONTH_NAMES[d.month - 1] ?? ""} ${String(d.year)}`);
  const cashIn = data.map((d) => d.cash_in);
  const cashOut = data.map((d) => -Math.abs(d.cash_out)); // negative for downward bars
  const netFlow = data.map((d) => d.net_flow);

  // Waterfall helper: cumulative opening balance for each bar
  const helper: number[] = [];
  let cumulative = 0;
  for (const item of data) {
    helper.push(cumulative);
    cumulative += item.net_flow;
  }

  return { labels, cashIn, cashOut, netFlow, helper };
}

interface Props {
  data: CashFlowData[];
  height?: number;
}

export default function CashFlowWaterfall({ data, height = 400 }: Props) {
  const option = useMemo(() => {
    const { labels, cashIn, cashOut, netFlow, helper } = transformCashFlowData(data);

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter: (params: { seriesName: string; value: number; axisValueLabel: string }[]) => {
          let html = `<strong>${params[0]?.axisValueLabel ?? ""}</strong><br/>`;
          for (const p of params) {
            if (p.seriesName === "base") continue; // hide transparent helper
            const color = p.seriesName === "Giriş" ? "#22c55e" : p.seriesName === "Çıkış" ? "#ef4444" : "#3b82f6";
            html += `<span style="color:${color}">●</span> ${p.seriesName}: ₺${Math.abs(p.value).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}<br/>`;
          }
          return html;
        },
      },
      legend: { data: ["Giriş", "Çıkış", "Net Akış"], bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: { type: "category" as const, data: labels },
      yAxis: {
        type: "value" as const,
        axisLabel: { formatter: (v: number) => `₺${(v / 1000).toFixed(0)}K` },
      },
      series: [
        // Transparent helper (invisible base)
        {
          name: "base",
          type: "bar" as const,
          stack: "waterfall",
          data: helper,
          itemStyle: { color: "transparent" },
          emphasis: { itemStyle: { color: "transparent" } },
        },
        // Positive inflows (green)
        {
          name: "Giriş",
          type: "bar" as const,
          stack: "waterfall",
          data: cashIn,
          itemStyle: { color: "#22c55e" },
        },
        // Negative outflows (red, downward bars)
        {
          name: "Çıkış",
          type: "bar" as const,
          stack: "waterfall",
          data: cashOut,
          itemStyle: { color: "#ef4444" },
        },
        // Net flow line overlay
        {
          name: "Net Akış",
          type: "line" as const,
          data: netFlow,
          itemStyle: { color: "#3b82f6" },
          lineStyle: { width: 2 },
          symbol: "circle",
          symbolSize: 6,
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Nakit akışı verisi bulunamadı</div>;
  }

  return <ReactECharts option={option} style={{ height }} />;
}
