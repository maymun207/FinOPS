"use client";

/**
 * KPICard — Tremor Card + BadgeDelta + DeltaBar for KPI display.
 *
 * Uses Tremor's Card, BadgeDelta, and DeltaBar components.
 * Shows current value and % delta vs prior period.
 */
import React from "react";
import { Card, BadgeDelta, DeltaBar, Flex, Metric, Text } from "@tremor/react";
import { formatTRY } from "@/components/grids/grid-types";

export interface KPICardProps {
  /** Card title (e.g., "Gelir", "Gider") */
  title: string;
  /** Metric value — monetary amount as string from DB */
  value: string;
  /** Whether to format as TRY currency */
  isCurrency?: boolean;
  /** Optional delta percentage for comparison vs prior period */
  delta?: number;
  /** Delta label (e.g., "önceki döneme göre") */
  deltaLabel?: string;
  /** Icon emoji */
  icon?: string;
}

/** Classify delta as Tremor DeltaType */
export function classifyDelta(
  delta: number
): "increase" | "moderateIncrease" | "unchanged" | "moderateDecrease" | "decrease" {
  if (delta > 10) return "increase";
  if (delta > 0) return "moderateIncrease";
  if (delta === 0) return "unchanged";
  if (delta > -10) return "moderateDecrease";
  return "decrease";
}

/**
 * Compute % delta between current and prior period values.
 * Returns 0 if prior is 0 (avoids division by zero).
 */
export function computeDeltaPercent(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function KPICard({
  title,
  value,
  isCurrency = true,
  delta,
  deltaLabel,
  icon,
}: KPICardProps) {
  const formattedValue = isCurrency
    ? formatTRY(parseFloat(value))
    : value;

  const deltaType = delta !== undefined ? classifyDelta(delta) : undefined;

  return (
    <Card
      className="ring-1 ring-slate-700/50"
      decoration="top"
      decorationColor={
        deltaType === "increase" || deltaType === "moderateIncrease"
          ? "emerald"
          : deltaType === "decrease" || deltaType === "moderateDecrease"
          ? "rose"
          : "slate"
      }
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "0.75rem",
        minWidth: "200px",
      }}
    >
      {/* Title row */}
      <Flex justifyContent="between" alignItems="center">
        <Text
          style={{
            color: "#94a3b8",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {icon && <span style={{ marginRight: "0.375rem" }}>{icon}</span>}
          {title}
        </Text>
        {delta !== undefined && deltaType && (
          <BadgeDelta
            deltaType={deltaType}
            size="xs"
          >
            {Math.abs(delta).toFixed(1)}%
          </BadgeDelta>
        )}
      </Flex>

      {/* Value */}
      <Metric
        style={{
          color: "#e2e8f0",
          fontSize: "1.5rem",
          fontWeight: 700,
          marginTop: "0.5rem",
        }}
      >
        {formattedValue}
      </Metric>

      {/* Delta bar + label */}
      {delta !== undefined && (
        <>
          <DeltaBar
            value={Math.min(Math.max(delta, -100), 100)}
            className="mt-3"
            style={{ height: "6px" }}
          />
          {deltaLabel && (
            <Text
              style={{
                color: "#64748b",
                fontSize: "0.75rem",
                marginTop: "0.375rem",
              }}
            >
              {deltaLabel}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}
