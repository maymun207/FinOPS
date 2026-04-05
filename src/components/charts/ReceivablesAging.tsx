"use client";
/**
 * ReceivablesAging — ECharts stacked bar chart for aging receivables.
 *
 * Aging buckets: 0-30, 31-60, 61-90, 90+ days.
 * Stacked per contact for visibility into overdue receivables.
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface AgingData {
  contact_id: string;
  contact_name: string | null;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_receivable: number;
}

interface Props {
  data: AgingData[];
  height?: number;
}

export default function ReceivablesAging({ data, height = 400 }: Props) {
  const option = useMemo(() => {
    const contacts = data.map((d) => d.contact_name ?? d.contact_id.slice(0, 8));

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
      },
      legend: { data: ["0-30 Gün", "31-60 Gün", "61-90 Gün", "90+ Gün"], bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: { type: "category" as const, data: contacts, axisLabel: { rotate: 30 } },
      yAxis: {
        type: "value" as const,
        axisLabel: { formatter: (v: number) => `₺${(v / 1000).toFixed(0)}K` },
      },
      series: [
        {
          name: "0-30 Gün",
          type: "bar" as const,
          stack: "aging",
          data: data.map((d) => Number(d.bucket_0_30)),
          itemStyle: { color: "#22c55e" },
        },
        {
          name: "31-60 Gün",
          type: "bar" as const,
          stack: "aging",
          data: data.map((d) => Number(d.bucket_31_60)),
          itemStyle: { color: "#f59e0b" },
        },
        {
          name: "61-90 Gün",
          type: "bar" as const,
          stack: "aging",
          data: data.map((d) => Number(d.bucket_61_90)),
          itemStyle: { color: "#f97316" },
        },
        {
          name: "90+ Gün",
          type: "bar" as const,
          stack: "aging",
          data: data.map((d) => Number(d.bucket_90_plus)),
          itemStyle: { color: "#ef4444" },
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Alacak yaşlandırma verisi bulunamadı</div>;
  }

  return <ReactECharts option={option} style={{ height }} />;
}
