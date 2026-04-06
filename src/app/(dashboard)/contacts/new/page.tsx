"use client";

/**
 * New Contact Page — /dashboard/contacts/new
 *
 * Full-page contact creation form.
 */
import React from "react";
import { useRouter } from "next/navigation";
import { ContactForm } from "@/components/forms/ContactForm";

export default function NewContactPage() {
  const router = useRouter();

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: "700px",
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
          ← Cari Kartlara Dön
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
          Yeni Cari Kart
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "0.875rem",
            margin: "0.25rem 0 0 0",
          }}
        >
          Müşteri veya tedarikçi bilgilerini girin
        </p>
      </div>

      <ContactForm onSuccess={() => { router.push("/dashboard/contacts"); }} />
    </div>
  );
}
