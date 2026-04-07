/**
 * Invoices Page — /invoices
 *
 * Lists all invoices (Faturalar) for the current company.
 * Matches the contacts page pattern exactly.
 */
"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

const STATUS_LABELS: Record<string, string> = {
    draft: "Taslak",
    sent: "Gönderildi",
    paid: "Ödendi",
    cancelled: "İptal",
};

const STATUS_COLORS: Record<string, string> = {
    draft: "#64748b",
    sent: "#3b82f6",
    paid: "#22c55e",
    cancelled: "#ef4444",
};

const DIRECTION_LABELS: Record<string, string> = {
    inbound: "Alış",
    outbound: "Satış",
};

export default function InvoicesPage() {
    const router = useRouter();

    const { data, isLoading } = trpc.invoice.list.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const formatCurrency = (amount: string | null, currency = "TRY") => {
        if (!amount) return "—";
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency,
        }).format(parseFloat(amount));
    };

    const formatDate = (date: string | null) => {
        if (!date) return "—";
        return new Date(date).toLocaleDateString("tr-TR");
    };

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
                        Faturalar
                    </h1>
                    <p
                        style={{
                            color: "#94a3b8",
                            fontSize: "0.875rem",
                            margin: "0.25rem 0 0 0",
                        }}
                    >
                        Alış ve satış faturalarını yönetin
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
                            {data.length} kayıt
                        </span>
                    )}
                    <button
                        onClick={() => { router.push("/invoices/new"); }}
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
                        + Yeni Fatura
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {isLoading ? (
                    <div style={{ color: "#64748b", padding: "2rem", textAlign: "center" }}>
                        Yükleniyor...
                    </div>
                ) : !data || data.length === 0 ? (
                    <div
                        style={{
                            color: "#64748b",
                            padding: "4rem",
                            textAlign: "center",
                            fontSize: "0.875rem",
                        }}
                    >
                        Henüz fatura yok. İlk faturanızı oluşturun.
                    </div>
                ) : (
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: "0.875rem",
                        }}
                    >
                        <thead>
                            <tr style={{ borderBottom: "1px solid #1e293b" }}>
                                {["Fatura No", "Tarih", "Tür", "Cari", "Toplam", "KDV", "Genel Toplam", "Durum"].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: "0.625rem 0.75rem",
                                            textAlign: "left",
                                            color: "#64748b",
                                            fontWeight: 500,
                                            fontSize: "0.75rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((inv) => (
                                <tr
                                    key={inv.id}
                                    onClick={() => { router.push(`/invoices/${inv.id}`); }}
                                    style={{
                                        borderBottom: "1px solid #0f172a",
                                        cursor: "pointer",
                                        transition: "background-color 0.1s",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#1e293b";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent";
                                    }}
                                >
                                    <td style={{ padding: "0.75rem", color: "#e2e8f0", fontFamily: "monospace", fontSize: "0.8125rem" }}>
                                        {inv.invoiceNumber}
                                    </td>
                                    <td style={{ padding: "0.75rem", color: "#94a3b8" }}>
                                        {formatDate(inv.invoiceDate)}
                                    </td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span
                                            style={{
                                                padding: "0.125rem 0.5rem",
                                                borderRadius: "0.25rem",
                                                fontSize: "0.75rem",
                                                fontWeight: 500,
                                                backgroundColor: inv.direction === "outbound" ? "#1e3a5f" : "#1a2e1a",
                                                color: inv.direction === "outbound" ? "#93c5fd" : "#86efac",
                                            }}
                                        >
                                            {DIRECTION_LABELS[inv.direction] ?? inv.direction}
                                        </span>
                                    </td>
                                    <td style={{ padding: "0.75rem", color: "#94a3b8" }}>
                                        {inv.contactName ?? "—"}
                                    </td>
                                    <td style={{ padding: "0.75rem", color: "#94a3b8", textAlign: "right" }}>
                                        {formatCurrency(inv.subtotal, inv.currency)}
                                    </td>
                                    <td style={{ padding: "0.75rem", color: "#64748b", textAlign: "right" }}>
                                        {formatCurrency(inv.kdvTotal, inv.currency)}
                                    </td>
                                    <td style={{ padding: "0.75rem", color: "#e2e8f0", fontWeight: 600, textAlign: "right" }}>
                                        {formatCurrency(inv.grandTotal, inv.currency)}
                                    </td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span
                                            style={{
                                                padding: "0.125rem 0.5rem",
                                                borderRadius: "0.25rem",
                                                fontSize: "0.75rem",
                                                fontWeight: 500,
                                                backgroundColor: `${STATUS_COLORS[inv.status] ?? "#64748b"}22`,
                                                color: STATUS_COLORS[inv.status] ?? "#64748b",
                                            }}
                                        >
                                            {STATUS_LABELS[inv.status] ?? inv.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}