"use client";
/**
 * KDVByRate — ECharts grouped bar chart for KDV amounts by tax rate.
 *
 * Shows matrah (tax base), KDV amount, and grand total grouped by rate.
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface KdvData {
  kdv_rate: number;
  invoice_count: number;
  total_subtotal: number;
  total_kdv: number;
  total_grand: number;
}

interface Props {
  data: KdvData[];
  height?: number;
}

export default function KDVByRate({ data, height = 400 }: Props) {
  const option = useMemo(() => {
    const rates = data.map((d) => `%${d.kdv_rate}`);

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
      },
      legend: { data: ["Matrah", "KDV Tutarı", "Genel Toplam"], bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: { type: "category" as const, data: rates },
      yAxis: {
        type: "value" as const,
        axisLabel: { formatter: (v: number) => `₺${(v / 1000).toFixed(0)}K` },
      },
      series: [
        {
          name: "Matrah",
          type: "bar" as const,
          data: data.map((d) => Number(d.total_subtotal)),
          itemStyle: { color: "#6366f1" },
        },
        {
          name: "KDV Tutarı",
          type: "bar" as const,
          data: data.map((d) => Number(d.total_kdv)),
          itemStyle: { color: "#f59e0b" },
        },
        {
          name: "Genel Toplam",
          type: "bar" as const,
          data: data.map((d) => Number(d.total_grand)),
          itemStyle: { color: "#1B2B4B" },
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>KDV verisi bulunamadı</div>;
  }

  return <ReactECharts option={option} style={{ height }} />;
}
