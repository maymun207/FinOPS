"use client";

/**
 * ContactForm — Cari Kart oluşturma/düzenleme formu.
 *
 * Features:
 *   - Controlled inputs with Turkish labels
 *   - Type dropdown: Müşteri / Tedarikçi / Her İkisi
 *   - Validation feedback before submit
 *   - Calls trpc.contact.create or trpc.contact.update
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";

export interface ContactFormData {
  name: string;
  type: "customer" | "vendor" | "both";
  taxId: string;
  email: string;
  phone: string;
  address: string;
}

interface ContactFormProps {
  /** Pre-filled data for editing. If absent, this is a create form. */
  initialData?: ContactFormData & { id: string };
  /** Called after successful save */
  onSuccess?: () => void;
}

const TYPE_OPTIONS = [
  { value: "customer", label: "Müşteri" },
  { value: "vendor", label: "Tedarikçi" },
  { value: "both", label: "Her İkisi" },
] as const;

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
  transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.375rem",
  display: "block",
};

export function ContactForm({ initialData, onSuccess }: ContactFormProps) {
  const [form, setForm] = useState<ContactFormData>({
    name: initialData?.name ?? "",
    type: initialData?.type ?? "customer",
    taxId: initialData?.taxId ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    address: initialData?.address ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const createMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      onSuccess?.();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.contact.update.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
      onSuccess?.();
    },
    onError: (err) => setError(err.message),
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("İsim alanı zorunludur");
      return;
    }

    if (initialData?.id) {
      updateMutation.mutate({ id: initialData.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleChange = (
    field: keyof ContactFormData,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        maxWidth: "600px",
      }}
    >
      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label style={labelStyle} htmlFor="contact-name">
          İsim / Ticaret Unvanı *
        </label>
        <input
          id="contact-name"
          type="text"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          style={inputStyle}
          placeholder="Örn: ABC Ltd. Şti."
          required
        />
      </div>

      {/* Type */}
      <div>
        <label style={labelStyle} htmlFor="contact-type">
          Tür *
        </label>
        <select
          id="contact-type"
          value={form.type}
          onChange={(e) =>
            handleChange("type", e.target.value as ContactFormData["type"])
          }
          style={inputStyle}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tax ID + Email row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle} htmlFor="contact-tax-id">
            VKN / TCKN
          </label>
          <input
            id="contact-tax-id"
            type="text"
            value={form.taxId}
            onChange={(e) => handleChange("taxId", e.target.value)}
            style={inputStyle}
            placeholder="Vergi Kimlik No"
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="contact-email">
            E-posta
          </label>
          <input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            style={inputStyle}
            placeholder="info@firma.com"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label style={labelStyle} htmlFor="contact-phone">
          Telefon
        </label>
        <input
          id="contact-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          style={inputStyle}
          placeholder="+90 212 000 00 00"
        />
      </div>

      {/* Address */}
      <div>
        <label style={labelStyle} htmlFor="contact-address">
          Adres
        </label>
        <textarea
          id="contact-address"
          value={form.address}
          onChange={(e) => handleChange("address", e.target.value)}
          style={{
            ...inputStyle,
            minHeight: "80px",
            resize: "vertical",
          }}
          placeholder="Tam adres"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: "0.75rem 1.5rem",
          borderRadius: "0.5rem",
          border: "none",
          backgroundColor: isLoading ? "#334155" : "#3b82f6",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "background-color 0.2s",
          fontFamily: "Inter, system-ui, sans-serif",
          alignSelf: "flex-start",
        }}
      >
        {isLoading
          ? "Kaydediliyor..."
          : initialData
          ? "Güncelle"
          : "Kaydet"}
      </button>
    </form>
  );
}
