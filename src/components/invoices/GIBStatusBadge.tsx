"use client";

/**
 * GIBStatusBadge — Renders a colored badge with icon for each gib_status value.
 *
 * States:
 *   null/undefined  → no badge (not submitted)
 *   "pending"       → yellow spinner
 *   "accepted"      → green checkmark
 *   "rejected"      → red X
 */
import React from "react";

interface Props {
  status: "pending" | "accepted" | "rejected" | null | undefined;
  /** Optional: compact mode for table cells */
  compact?: boolean;
}

const STATUS_CONFIG = {
  pending: {
    label: "GİB Bekliyor",
    icon: "⏳",
    bg: "#422006",
    border: "#854d0e",
    text: "#fbbf24",
    dot: "#eab308",
  },
  accepted: {
    label: "GİB Onaylandı",
    icon: "✅",
    bg: "#052e16",
    border: "#166534",
    text: "#4ade80",
    dot: "#22c55e",
  },
  rejected: {
    label: "GİB Reddedildi",
    icon: "❌",
    bg: "#1c1917",
    border: "#991b1b",
    text: "#f87171",
    dot: "#ef4444",
  },
} as const;

export function GIBStatusBadge({ status, compact = false }: Props) {
  if (!status) return null;

  const config = STATUS_CONFIG[status];
  // config is always defined for valid status values

  if (compact) {
    return (
      <span
        id={`gib-badge-${status}`}
        title={config.label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 600,
          background: config.bg,
          border: `1px solid ${config.border}`,
          color: config.text,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: config.dot,
            ...(status === "pending" ? { animation: "pulse 1.5s infinite" } : {}),
          }}
        />
        {config.label}
      </span>
    );
  }

  return (
    <div
      id={`gib-badge-${status}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 8,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <span style={{ fontSize: 16 }}>{config.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: config.text }}>
          {config.label}
        </div>
        {status === "pending" && (
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
            İşlem devam ediyor...
          </div>
        )}
      </div>
      {status === "pending" && (
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      )}
    </div>
  );
}
