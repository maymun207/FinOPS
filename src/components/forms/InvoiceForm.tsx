"use client";

/**
 * InvoiceForm — Fatura oluşturma formu.
 *
 * Features:
 *   - Invoice header: number, date, due date, direction, contact, notes
 *   - Embedded InvoiceLineItemsGrid with live KDV
 *   - Computed footer: subtotal, kdvTotal, grandTotal
 *   - Calls trpc.invoice.create on submit
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  InvoiceLineItemsGrid,
  createEmptyLine,
  type InvoiceLineRow as _InvoiceLineRow,
} from "@/components/grids/InvoiceLineItemsGrid";
import { formatTRY } from "@/components/grids/grid-types";

interface InvoiceFormProps {
  /** Called after successful creation */
  onSuccess?: () => void;
}

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

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    (new Date().toISOString().split("T")[0] ?? "")
  );
  const [dueDate, setDueDate] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">(
    "outbound"
  );
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState([
    createEmptyLine(),
  ]);
  const [error, setError] = useState<string | null>(null);

  // Fetch contacts for dropdown
  const { data: contactsData } = trpc.contact.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      void utils.invoice.list.invalidate();
      void utils.journal.list.invalidate();
      onSuccess?.();
    },
    onError: (err) => { setError(err.message); },
  });

  // Compute totals from line items
  const totals = useMemo(() => {
    let subtotal = 0;
    let kdvTotal = 0;
    let grandTotal = 0;

    for (const line of lineItems) {
      subtotal += parseFloat(line.subtotal) || 0;
      kdvTotal += parseFloat(line.kdvAmount) || 0;
      grandTotal += parseFloat(line.total) || 0;
    }

    return { subtotal, kdvTotal, grandTotal };
  }, [lineItems]);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!invoiceNumber.trim()) {
      setError("Fatura numarası zorunludur");
      return;
    }

    if (!invoiceDate) {
      setError("Fatura tarihi zorunludur");
      return;
    }

    const validLines = lineItems.filter((l) => l.description.trim());
    if (validLines.length === 0) {
      setError("En az 1 kalem eklenmelidir");
      return;
    }

    createMutation.mutate({
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate || undefined,
      direction,
      contactId: contactId || undefined,
      notes: notes || undefined,
      lines: validLines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        kdvRate: l.kdvRate,
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Error */}
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

      {/* ── Header fields ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
        }}
      >
        {/* Invoice Number */}
        <div>
          <label style={labelStyle} htmlFor="invoice-number">
            Fatura No *
          </label>
          <input
            id="invoice-number"
            type="text"
            value={invoiceNumber}
            onChange={(e) => { setInvoiceNumber(e.target.value); }}
            style={inputStyle}
            placeholder="FTR-2026-001"
            required
          />
        </div>

        {/* Invoice Date */}
        <div>
          <label style={labelStyle} htmlFor="invoice-date">
            Fatura Tarihi *
          </label>
          <input
            id="invoice-date"
            type="date"
            value={invoiceDate}
            onChange={(e) => { setInvoiceDate(e.target.value); }}
            style={inputStyle}
            required
          />
        </div>

        {/* Due Date */}
        <div>
          <label style={labelStyle} htmlFor="invoice-due-date">
            Vade Tarihi
          </label>
          <input
            id="invoice-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); }}
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        {/* Direction */}
        <div>
          <label style={labelStyle} htmlFor="invoice-direction">
            Fatura Türü *
          </label>
          <select
            id="invoice-direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as "inbound" | "outbound");
            }}
            style={inputStyle}
          >
            <option value="outbound">Satış Faturası</option>
            <option value="inbound">Alış Faturası</option>
          </select>
        </div>

        {/* Contact */}
        <div>
          <label style={labelStyle} htmlFor="invoice-contact">
            Cari Hesap
          </label>
          <select
            id="invoice-contact"
            value={contactId}
            onChange={(e) => { setContactId(e.target.value); }}
            style={inputStyle}
          >
            <option value="">— Seçiniz —</option>
            {contactsData?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle} htmlFor="invoice-notes">
          Notlar
        </label>
        <textarea
          id="invoice-notes"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); }}
          style={{
            ...inputStyle,
            minHeight: "60px",
            resize: "vertical",
          }}
          placeholder="Opsiyonel notlar..."
        />
      </div>

      {/* ── Line Items Grid ───────────────────────────────────────── */}
      <div>
        <h3
          style={{
            color: "#e2e8f0",
            fontSize: "1rem",
            fontWeight: 600,
            margin: "0 0 0.75rem 0",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Fatura Kalemleri
        </h3>
        <InvoiceLineItemsGrid
          rows={lineItems}
          onChange={setLineItems}
          height="300px"
        />
      </div>

      {/* ── Totals footer ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "2rem",
          padding: "1rem 1.5rem",
          borderRadius: "0.5rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
            Ara Toplam
          </div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "1rem" }}>
            {formatTRY(totals.subtotal)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>KDV</div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "1rem" }}>
            {formatTRY(totals.kdvTotal)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
            Genel Toplam
          </div>
          <div
            style={{
              color: "#3b82f6",
              fontWeight: 700,
              fontSize: "1.125rem",
            }}
          >
            {formatTRY(totals.grandTotal)}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={createMutation.isPending}
        style={{
          padding: "0.875rem 2rem",
          borderRadius: "0.5rem",
          border: "none",
          backgroundColor: createMutation.isPending ? "#334155" : "#3b82f6",
          color: "#fff",
          fontSize: "0.9375rem",
          fontWeight: 600,
          cursor: createMutation.isPending ? "not-allowed" : "pointer",
          transition: "background-color 0.2s",
          fontFamily: "Inter, system-ui, sans-serif",
          alignSelf: "flex-end",
        }}
      >
        {createMutation.isPending ? "Kaydediliyor..." : "Faturayı Kaydet"}
      </button>
    </form>
  );
}
