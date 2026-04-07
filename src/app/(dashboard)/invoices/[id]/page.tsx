/**
 * Invoice Detail Page — /invoices/[id]
 *
 * Shows full invoice details including line items, contact info,
 * journal entry status, and action buttons (edit status, delete).
 */
"use client";
import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
    inbound: "Alış Faturası",
    outbound: "Satış Faturası",
};

export default function InvoiceDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data: invoice, isLoading, error } = trpc.invoice.getById.useQuery(
        { id },
        { enabled: !!id, refetchOnWindowFocus: false }
    );

    const deleteMutation = trpc.invoice.delete.useMutation({
        onSuccess: () => { router.push("/invoices"); },
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
        return new Date(date).toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    if (isLoading) {
        return (
            <div style={{ padding: "2rem", color: "#64748b", fontFamily: "Inter, system-ui, sans-serif" }}>
                Yükleniyor...
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div style={{ padding: "2rem", fontFamily: "Inter, system-ui, sans-serif" }}>
                <p style={{ color: "#ef4444" }}>Fatura bulunamadı.</p>
                <button
                    onClick={() => { router.push("/invoices"); }}
                    style={{ marginTop: "1rem", color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
                >
                    ← Faturalara dön
                </button>
            </div>
        );
    }

    const isOutbound = invoice.direction === "outbound";

    return (
        <div style={{ padding: "1.5rem", fontFamily: "Inter, system-ui, sans-serif", maxWidth: "900px" }}>

            {/* Back button + Header */}
            <div style={{ marginBottom: "1.5rem" }}>
                <button
                    onClick={() => { router.push("/invoices"); }}
                    style={{
                        background: "none", border: "none", color: "#64748b",
                        fontSize: "0.8125rem", cursor: "pointer", padding: "0",
                        marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem"
                    }}
                >
                    ← Faturalara dön
                </button>

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                                {invoice.invoiceNumber}
                            </h1>
                            <span style={{
                                padding: "0.25rem 0.75rem", borderRadius: "0.375rem",
                                fontSize: "0.75rem", fontWeight: 600,
                                backgroundColor: isOutbound ? "#1e3a5f" : "#1a2e1a",
                                color: isOutbound ? "#93c5fd" : "#86efac",
                            }}>
                                {DIRECTION_LABELS[invoice.direction] ?? invoice.direction}
                            </span>
                            <span style={{
                                padding: "0.25rem 0.75rem", borderRadius: "0.375rem",
                                fontSize: "0.75rem", fontWeight: 600,
                                backgroundColor: `${STATUS_COLORS[invoice.status] ?? "#64748b"}22`,
                                color: STATUS_COLORS[invoice.status] ?? "#64748b",
                            }}>
                                {STATUS_LABELS[invoice.status] ?? invoice.status}
                            </span>
                        </div>
                        <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.375rem 0 0 0" }}>
                            {formatDate(invoice.invoiceDate)}
                            {invoice.dueDate && ` · Vade: ${formatDate(invoice.dueDate)}`}
                        </p>
                    </div>

                    {/* Delete button */}
                    <div>
                        {confirmDelete ? (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                <span style={{ color: "#f87171", fontSize: "0.8125rem" }}>Emin misiniz?</span>
                                <button
                                    onClick={() => { deleteMutation.mutate({ id }); }}
                                    disabled={deleteMutation.isPending}
                                    style={{
                                        padding: "0.5rem 1rem", borderRadius: "0.375rem",
                                        border: "none", backgroundColor: "#ef4444",
                                        color: "#fff", fontSize: "0.8125rem", cursor: "pointer",
                                    }}
                                >
                                    {deleteMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
                                </button>
                                <button
                                    onClick={() => { setConfirmDelete(false); }}
                                    style={{
                                        padding: "0.5rem 1rem", borderRadius: "0.375rem",
                                        border: "1px solid #334155", backgroundColor: "transparent",
                                        color: "#94a3b8", fontSize: "0.8125rem", cursor: "pointer",
                                    }}
                                >
                                    İptal
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setConfirmDelete(true); }}
                                style={{
                                    padding: "0.5rem 1rem", borderRadius: "0.375rem",
                                    border: "1px solid #334155", backgroundColor: "transparent",
                                    color: "#94a3b8", fontSize: "0.8125rem", cursor: "pointer",
                                }}
                            >
                                Sil
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Contact */}
                <div style={{
                    padding: "1rem 1.25rem", borderRadius: "0.75rem",
                    border: "1px solid #1e293b", backgroundColor: "#0f172a",
                }}>
                    <p style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>Cari</p>
                    <p style={{ color: "#e2e8f0", fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>
                        {invoice.contactName ?? "—"}
                    </p>
                </div>

                {/* Fiscal period */}
                <div style={{
                    padding: "1rem 1.25rem", borderRadius: "0.75rem",
                    border: "1px solid #1e293b", backgroundColor: "#0f172a",
                }}>
                    <p style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>Notlar</p>
                    <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
                        {invoice.notes ?? "—"}
                    </p>
                </div>
            </div>

            {/* Totals */}
            <div style={{
                padding: "1.25rem 1.5rem", borderRadius: "0.75rem",
                border: "1px solid #1e293b", backgroundColor: "#0f172a",
                marginBottom: "1.5rem",
                display: "flex", gap: "2.5rem", flexWrap: "wrap",
            }}>
                <div>
                    <p style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>Ara Toplam</p>
                    <p style={{ color: "#94a3b8", fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                    </p>
                </div>
                <div>
                    <p style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>KDV</p>
                    <p style={{ color: "#94a3b8", fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
                        {formatCurrency(invoice.kdvTotal, invoice.currency)}
                    </p>
                </div>
                <div>
                    <p style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>Genel Toplam</p>
                    <p style={{ color: "#e2e8f0", fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>
                        {formatCurrency(invoice.grandTotal, invoice.currency)}
                    </p>
                </div>
            </div>

            {/* Line items */}
            <div style={{
                borderRadius: "0.75rem", border: "1px solid #1e293b",
                backgroundColor: "#0f172a", overflow: "hidden",
            }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #1e293b" }}>
                    <h2 style={{ color: "#e2e8f0", fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>
                        Kalemler ({invoice.lines.length})
                    </h2>
                </div>

                {invoice.lines.length === 0 ? (
                    <p style={{ color: "#64748b", padding: "1.5rem", margin: 0, fontSize: "0.875rem" }}>Kalem yok.</p>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #1e293b" }}>
                                {["Açıklama", "Miktar", "Birim Fiyat", "KDV %", "KDV Tutarı", "Toplam"].map((h) => (
                                    <th key={h} style={{
                                        padding: "0.625rem 1rem", textAlign: "left",
                                        color: "#64748b", fontWeight: 500,
                                        fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em",
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.lines.map((line, i) => (
                                <tr key={line.id} style={{
                                    borderBottom: i < invoice.lines.length - 1 ? "1px solid #1e293b" : "none",
                                }}>
                                    <td style={{ padding: "0.75rem 1rem", color: "#e2e8f0" }}>{line.description}</td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{line.quantity}</td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", textAlign: "right" }}>
                                        {formatCurrency(line.unitPrice, invoice.currency)}
                                    </td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", textAlign: "center" }}>
                                        %{line.kdvRate}
                                    </td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", textAlign: "right" }}>
                                        {formatCurrency(line.kdvAmount, invoice.currency)}
                                    </td>
                                    <td style={{ padding: "0.75rem 1rem", color: "#e2e8f0", fontWeight: 600, textAlign: "right" }}>
                                        {formatCurrency(line.total, invoice.currency)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Error from delete */}
            {deleteMutation.error && (
                <p style={{ color: "#ef4444", marginTop: "1rem", fontSize: "0.875rem" }}>
                    {deleteMutation.error.message}
                </p>
            )}
        </div>
    );
}
