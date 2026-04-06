"use client";

/**
 * Virtual CFO Page — AI-powered financial assistant.
 *
 * Route: /cfo
 * Features:
 *   - Natural language financial queries
 *   - AI-generated SQL with safety validation
 *   - Auto-chart detection (line, bar, grouped bar, KPI)
 *   - AG Grid results display
 *   - Feedback loop for training improvement
 */
import React from "react";
import dynamic from "next/dynamic";

const CFOChatSession = dynamic(
  () =>
    import("@/components/cfo/CFOChatSession").then((m) => ({
      default: m.CFOChatSession,
    })),
  { ssr: false },
);

export default function CFOPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🧠
          </div>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#e2e8f0",
                margin: 0,
              }}
            >
              Sanal CFO
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#64748b",
                margin: 0,
                marginTop: 2,
              }}
            >
              Yapay zeka destekli finansal danışman
            </p>
          </div>
        </div>

        {/* Usage hints */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          {[
            "Bu dönemde toplam KDV ne kadar?",
            "Aylık gelir/gider trendi",
            "En yüksek borç bakiyeli cariler",
            "Hesap bazında mizan",
          ].map((hint) => (
            <div
              key={hint}
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 20,
                padding: "4px 12px",
                cursor: "default",
              }}
            >
              💡 {hint}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Session */}
      <CFOChatSession />
    </div>
  );
}
