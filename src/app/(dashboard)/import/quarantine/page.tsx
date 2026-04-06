"use client";

/**
 * Quarantine Review Page — /dashboard/import/quarantine
 *
 * Displays quarantined import records for review.
 * Three tabs: Pending, Approved, Rejected.
 */
import React, { useState } from "react";
import { QuarantineReviewGrid } from "@/components/import/QuarantineReviewGrid";

type TabStatus = "pending" | "approved" | "rejected";

const TABS: { key: TabStatus; label: string; icon: string }[] = [
  { key: "pending", label: "Bekleyen", icon: "⏳" },
  { key: "approved", label: "Onaylanan", icon: "✅" },
  { key: "rejected", label: "Reddedilen", icon: "❌" },
];

export default function QuarantineReviewPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>("pending");

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>
            🔍 Karantina İnceleme
          </h1>
          <p style={{ opacity: 0.6, fontSize: "14px", marginTop: "8px" }}>
            İçe aktarılan verileri inceleyin, düzenleyin ve onaylayın
          </p>
        </div>

        <a
          href="/import"
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            background: "var(--accent, #6366f1)",
            color: "white",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          + Yeni İçe Aktarma
        </a>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border, #3f3f46)",
          paddingBottom: "0",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); }}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === tab.key ? 700 : 400,
              opacity: activeTab === tab.key ? 1 : 0.5,
              borderBottom: activeTab === tab.key
                ? "2px solid var(--accent, #6366f1)"
                : "2px solid transparent",
              marginBottom: "-1px",
              transition: "all 0.2s ease",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <QuarantineReviewGrid statusFilter={activeTab} />
    </div>
  );
}
