"use client";
/**
 * ExpenseTreemap — ECharts treemap for expenses grouped by TDHP category.
 *
 * Groups expense accounts by first digit of account code (TDHP standard)
 * to show cost distribution across major expense categories.
 */
import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface ExpenseData {
  account_code: string;
  account_name: string | null;
  net_amount: number;
}

/** TDHP first-digit group labels */
const TDHP_GROUPS: Record<string, string> = {
  "7": "Maliyet Hesapları",
  "6": "Gelir/Gider Hesapları",
  "5": "Özkaynak",
  "4": "Uzun Vadeli Yab. Kaynak",
  "3": "Kısa Vadeli Yab. Kaynak",
};

/** Transform flat expense rows into treemap hierarchy */
export function transformExpenseData(data: ExpenseData[]) {
  const groups = new Map<string, { name: string; children: { name: string; value: number }[] }>();

  for (const d of data) {
    const digit = d.account_code.charAt(0);
    const groupLabel = TDHP_GROUPS[digit] ?? `Grup ${digit}`;

    if (!groups.has(digit)) {
      groups.set(digit, { name: groupLabel, children: [] });
    }
    const group = groups.get(digit);
    if (group) {
      group.children.push({
        name: `${d.account_code} — ${d.account_name ?? ""}`,
        value: Math.abs(d.net_amount),
      });
    }
  }

  return Array.from(groups.values());
}

interface Props {
  data: ExpenseData[];
  height?: number;
}

export default function ExpenseTreemap({ data, height = 400 }: Props) {
  const option = useMemo(() => {
    const treeData = transformExpenseData(data);

    return {
      tooltip: {
        formatter: (info: { name: string; value: number }) =>
          `${info.name}<br/>₺${info.value.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
      },
      series: [
        {
          type: "treemap" as const,
          data: treeData,
          width: "96%",
          height: "90%",
          top: "5%",
          left: "2%",
          label: { show: true, fontSize: 10 },
          upperLabel: { show: true, height: 24, color: "#fff" },
          levels: [
            {
              itemStyle: {
                borderColor: "#1B2B4B",
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: {
                show: true,
                backgroundColor: "#1B2B4B",
                padding: [4, 8],
                fontSize: 11,
                fontWeight: "bold" as const,
              },
            },
            {
              itemStyle: { borderColor: "#e5e7eb", borderWidth: 1, gapWidth: 1 },
              label: { fontSize: 9 },
            },
          ],
        },
      ],
    };
  }, [data]);

  if (data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Gider verisi bulunamadı</div>;
  }

  return <ReactECharts option={option} style={{ height }} />;
}
