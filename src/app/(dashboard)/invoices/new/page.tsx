"use client";

/**
 * New Invoice Page — /dashboard/invoices/new
 *
 * Full-page invoice creation with embedded line items grid.
 */
import React from "react";
import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/forms/InvoiceForm";

export default function NewInvoicePage() {
  const router = useRouter();

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Page header */}
      <div>
        <button
          onClick={() => { router.back(); }}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: "0.8125rem",
            cursor: "pointer",
            padding: 0,
            fontFamily: "Inter, system-ui, sans-serif",
            marginBottom: "0.5rem",
            display: "block",
          }}
        >
          ← Geri Dön
        </button>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#e2e8f0",
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Yeni Fatura Oluştur
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.875rem",
            margin: "0.25rem 0 0 0",
          }}
        >
          Fatura bilgilerini ve kalemlerini girin
        </p>
      </div>

      <InvoiceForm onSuccess={() => { router.push("/ledger"); }} />
    </div>
  );
}
