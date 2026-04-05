"use client";

/**
 * Fiscal periods settings page — /dashboard/settings/periods
 *
 * Provides the FiscalPeriodManager UI for viewing and managing
 * accounting periods (open/close with hard confirmation).
 */
import React from "react";
import { FiscalPeriodManager } from "@/components/fiscal/FiscalPeriodManager";

export default function PeriodsSettingsPage() {
  return (
    <main
      style={{
        padding: "1.5rem",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#e2e8f0",
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Mali Dönemler
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.875rem",
            margin: "0.25rem 0 0 0",
          }}
        >
          Muhasebe dönemlerinizi görüntüleyin ve yönetin
        </p>
      </div>

      {/* Period Manager */}
      <FiscalPeriodManager />
    </main>
  );
}
