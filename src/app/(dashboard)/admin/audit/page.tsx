"use client";

/**
 * Audit log admin page — /admin/audit
 *
 * Read-only viewer for the immutable audit trail.
 * Administrator-only access.
 */
import React from "react";
import { AuditLogGrid } from "@/components/grids/AuditLogGrid";

export default function AuditLogPage() {
  return (
    <main
      style={{
        padding: "1.5rem",
        maxWidth: "1400px",
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
          Denetim Günlüğü
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.875rem",
            margin: "0.25rem 0 0 0",
          }}
        >
          Tüm veri değişikliklerinin değiştirilemez kaydı
        </p>
      </div>

      {/* Audit Grid */}
      <AuditLogGrid />
    </main>
  );
}
