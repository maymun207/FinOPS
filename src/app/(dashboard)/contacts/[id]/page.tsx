/**
 * Contact Detail Page — /contacts/[id]
 *
 * Shows full contact details with inline edit capability.
 * Uses contact.getById, contact.update, and contact.delete tRPC procedures.
 */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

const TYPE_LABELS: Record<string, string> = {
    customer: "Müşteri",
    vendor: "Tedarikçi",
    both: "Müşteri & Tedarikçi",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    customer: { bg: "#1e3a5f", text: "#93c5fd" },
    vendor: { bg: "#1a2e1a", text: "#86efac" },
    both: { bg: "#2d1e3a", text: "#c4b5fd" },
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    fontSize: "0.875rem",
    fontFamily: "Inter, system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#64748b",
    fontSize: "0.6875rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.375rem",
};

export default function ContactDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [form, setForm] = useState({
        name: "",
        type: "customer" as "customer" | "vendor" | "both",
        taxId: "",
        email: "",
        phone: "",
        address: "",
    });

    const { data: contact, isLoading, error, refetch } = trpc.contact.getById.useQuery(
        { id },
        { enabled: !!id, refetchOnWindowFocus: false }
    );

    const updateMutation = trpc.contact.update.useMutation({
        onSuccess: () => {
            setEditing(false);
            void refetch();
        },
    });

    const deleteMutation = trpc.contact.delete.useMutation({
        onSuccess: () => { router.push("/contacts"); },
    });

    // Sync form when contact data loads
    useEffect(() => {
        if (contact) {
            setForm({
                name: contact.name,
                type: contact.type as "customer" | "vendor" | "both",
                taxId: contact.taxId ?? "",
                email: contact.email ?? "",
                phone: contact.phone ?? "",
                address: contact.address ?? "",
            });
        }
    }, [contact]);

    const handleSave = () => {
        updateMutation.mutate({
            id,
            name: form.name,
            type: form.type,
            taxId: form.taxId || undefined,
            email: form.email || undefined,
            phone: form.phone || undefined,
            address: form.address || undefined,
        });
    };

    const handleCancelEdit = () => {
        if (contact) {
            setForm({
                name: contact.name,
                type: contact.type as "customer" | "vendor" | "both",
                taxId: contact.taxId ?? "",
                email: contact.email ?? "",
                phone: contact.phone ?? "",
                address: contact.address ?? "",
            });
        }
        setEditing(false);
    };

    if (isLoading) {
        return (
            <div style={{ padding: "2rem", color: "#64748b", fontFamily: "Inter, system-ui, sans-serif" }}>
                Yükleniyor...
            </div>
        );
    }

    if (error || !contact) {
        return (
            <div style={{ padding: "2rem", fontFamily: "Inter, system-ui, sans-serif" }}>
                <p style={{ color: "#ef4444" }}>Cari kart bulunamadı.</p>
                <button
                    onClick={() => { router.push("/contacts"); }}
                    style={{ marginTop: "1rem", color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
                >
                    ← Cari kartlara dön
                </button>
            </div>
        );
    }

    const typeColorBg = TYPE_COLORS[contact.type]?.bg ?? TYPE_COLORS.customer!.bg;
    const typeColorText = TYPE_COLORS[contact.type]?.text ?? TYPE_COLORS.customer!.text;

    return (
        <div style={{ padding: "1.5rem", fontFamily: "Inter, system-ui, sans-serif", maxWidth: "680px" }}>

            {/* Back */}
            <button
                onClick={() => { router.push("/contacts"); }}
                style={{
                    background: "none", border: "none", color: "#64748b",
                    fontSize: "0.8125rem", cursor: "pointer", padding: "0",
                    marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.25rem",
                }}
            >
                ← Cari kartlara dön
            </button>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                            {contact.name}
                        </h1>
                        <span style={{
                            padding: "0.25rem 0.75rem", borderRadius: "0.375rem",
                            fontSize: "0.75rem", fontWeight: 600,
                            backgroundColor: typeColorBg, color: typeColorText,
                        }}>
                            {TYPE_LABELS[contact.type] ?? contact.type}
                        </span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.8125rem", margin: "0.375rem 0 0 0" }}>
                        {new Date(contact.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} tarihinde oluşturuldu
                    </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {!editing && !confirmDelete && (
                        <>
                            <button
                                onClick={() => { setEditing(true); }}
                                style={{
                                    padding: "0.5rem 1.125rem", borderRadius: "0.375rem",
                                    border: "none", backgroundColor: "#3b82f6",
                                    color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                Düzenle
                            </button>
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
                        </>
                    )}

                    {editing && (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                style={{
                                    padding: "0.5rem 1.125rem", borderRadius: "0.375rem",
                                    border: "none", backgroundColor: "#22c55e",
                                    color: "#fff", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    padding: "0.5rem 1rem", borderRadius: "0.375rem",
                                    border: "1px solid #334155", backgroundColor: "transparent",
                                    color: "#94a3b8", fontSize: "0.8125rem", cursor: "pointer",
                                }}
                            >
                                İptal
                            </button>
                        </>
                    )}

                    {confirmDelete && (
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ color: "#f87171", fontSize: "0.8125rem" }}>Silmek istediğinizden emin misiniz?</span>
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
                    )}
                </div>
            </div>

            {/* Form / Detail fields */}
            <div style={{
                borderRadius: "0.75rem", border: "1px solid #1e293b",
                backgroundColor: "#0f172a", padding: "1.5rem",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem",
            }}>
                {/* Name */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Ad / Unvan</label>
                    {editing ? (
                        <input
                            style={inputStyle}
                            value={form.name}
                            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); }}
                        />
                    ) : (
                        <p style={{ color: "#e2e8f0", fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>{contact.name}</p>
                    )}
                </div>

                {/* Type */}
                <div>
                    <label style={labelStyle}>Tür</label>
                    {editing ? (
                        <select
                            style={inputStyle}
                            value={form.type}
                            onChange={(e) => { setForm((f) => ({ ...f, type: e.target.value as "customer" | "vendor" | "both" })); }}
                        >
                            <option value="customer">Müşteri</option>
                            <option value="vendor">Tedarikçi</option>
                            <option value="both">Müşteri & Tedarikçi</option>
                        </select>
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>{TYPE_LABELS[contact.type]}</p>
                    )}
                </div>

                {/* Tax ID */}
                <div>
                    <label style={labelStyle}>Vergi No</label>
                    {editing ? (
                        <input
                            style={inputStyle}
                            value={form.taxId}
                            placeholder="—"
                            onChange={(e) => { setForm((f) => ({ ...f, taxId: e.target.value })); }}
                        />
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0, fontFamily: "monospace" }}>
                            {contact.taxId ?? "—"}
                        </p>
                    )}
                </div>

                {/* Email */}
                <div>
                    <label style={labelStyle}>E-posta</label>
                    {editing ? (
                        <input
                            type="email"
                            style={inputStyle}
                            value={form.email}
                            placeholder="—"
                            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); }}
                        />
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
                            {contact.email ? (
                                <a href={`mailto:${contact.email}`} style={{ color: "#60a5fa", textDecoration: "none" }}>
                                    {contact.email}
                                </a>
                            ) : "—"}
                        </p>
                    )}
                </div>

                {/* Phone */}
                <div>
                    <label style={labelStyle}>Telefon</label>
                    {editing ? (
                        <input
                            type="tel"
                            style={inputStyle}
                            value={form.phone}
                            placeholder="—"
                            onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); }}
                        />
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
                            {contact.phone ?? "—"}
                        </p>
                    )}
                </div>

                {/* Address */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Adres</label>
                    {editing ? (
                        <textarea
                            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                            value={form.address}
                            placeholder="—"
                            onChange={(e) => { setForm((f) => ({ ...f, address: e.target.value })); }}
                        />
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0, lineHeight: "1.5" }}>
                            {contact.address ?? "—"}
                        </p>
                    )}
                </div>
            </div>

            {/* Errors */}
            {updateMutation.error && (
                <p style={{ color: "#ef4444", marginTop: "1rem", fontSize: "0.875rem" }}>
                    {updateMutation.error.message}
                </p>
            )}
            {deleteMutation.error && (
                <p style={{ color: "#ef4444", marginTop: "1rem", fontSize: "0.875rem" }}>
                    {deleteMutation.error.message}
                </p>
            )}
        </div>
    );
}
