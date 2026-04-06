"use client";

/**
 * Contacts Page — /dashboard/contacts
 *
 * Lists all contacts (Cari Kartlar) in an AG Grid.
 * "Yeni Kişi" button navigates to the create page.
 */
import React from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ContactsGrid, type ContactRow } from "@/components/grids/ContactsGrid";

export default function ContactsPage() {
  const router = useRouter();
  const { data, isLoading } = trpc.contact.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const rows: ContactRow[] = React.useMemo(() => {
    if (!data) return [];
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      taxId: c.taxId,
      email: c.email,
      phone: c.phone,
      address: c.address,
      createdAt: c.createdAt,
    }));
  }, [data]);

  return (
    <div
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "calc(100vh - 4rem)",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#e2e8f0",
              margin: 0,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Cari Kartlar
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.875rem",
              margin: "0.25rem 0 0 0",
            }}
          >
            Müşteri ve tedarikçi kayıtlarını yönetin
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {data && (
            <span
              style={{
                color: "#64748b",
                fontSize: "0.75rem",
                fontFamily: "monospace",
              }}
            >
              {rows.length} kayıt
            </span>
          )}
          <button
            onClick={() => { router.push("/contacts/new"); }}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
              transition: "background-color 0.2s",
            }}
          >
            + Yeni Kişi
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ContactsGrid
          rows={rows}
          loading={isLoading}
          height="100%"
          onRowClick={(id) => { router.push(`/contacts/${id}`); }}
        />
      </div>
    </div>
  );
}
