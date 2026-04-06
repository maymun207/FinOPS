"use client";

/**
 * RecordPaymentDialog — Payment recording dialog linked to an invoice.
 *
 * Captures payment amount, date, method, and reference.
 * Validates amount > 0 and displays remaining balance.
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatTRY } from "@/components/grids/grid-types";
import Decimal from "decimal.js";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: string;
  direction: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Banka Havalesi" },
  { value: "cash", label: "Nakit" },
  { value: "credit_card", label: "Kredi Kartı" },
  { value: "check", label: "Çek" },
];

export function RecordPaymentDialog({
  isOpen,
  invoiceId,
  invoiceNumber,
  grandTotal,
  direction,
  onClose,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState<
    "bank_transfer" | "cash" | "credit_card" | "check"
  >("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Get existing payments for this invoice to show remaining balance
  const { data: existingPayments } = trpc.payment.list.useQuery(
    { invoiceId },
    { enabled: isOpen }
  );

  const createMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      void utils.payment.list.invalidate();
      void utils.invoice.list.invalidate();
      void utils.dashboard.getKPIs.invalidate();
      resetForm();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const resetForm = () => {
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("bank_transfer");
    setReference("");
    setNotes("");
    setError(null);
  };

  if (!isOpen) return null;

  // Calculate remaining balance
  const paidTotal = existingPayments
    ? existingPayments.reduce(
        (sum, p) => sum.plus(p.amount),
        new Decimal(0)
      )
    : new Decimal(0);
  const remaining = new Decimal(grandTotal).minus(paidTotal);
  const parsedAmount = amount ? new Decimal(amount || "0") : new Decimal(0);
  const isValid = parsedAmount.gt(0) && paymentDate.length > 0;

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    createMutation.mutate({
      invoiceId,
      amount: parsedAmount.toFixed(2),
      paymentDate,
      method,
      reference: reference || undefined,
      notes: notes || undefined,
    });
  };

  const directionLabel = direction === "outbound" ? "Tahsilat" : "Ödeme";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          maxWidth: "480px",
          width: "90%",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <h3
            style={{
              color: "#e2e8f0",
              fontSize: "1.125rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            {directionLabel} Kaydı
          </h3>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.8125rem",
              margin: "0.25rem 0 0 0",
            }}
          >
            Fatura: <strong style={{ color: "#e2e8f0" }}>{invoiceNumber}</strong>
          </p>
        </div>

        {/* Balance summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.75rem",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            backgroundColor: "#0f172a",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <div style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase" }}>
              Toplam
            </div>
            <div style={{ color: "#e2e8f0", fontSize: "0.875rem", fontWeight: 600 }}>
              {formatTRY(parseFloat(grandTotal))}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase" }}>
              Ödenen
            </div>
            <div style={{ color: "#22c55e", fontSize: "0.875rem", fontWeight: 600 }}>
              {formatTRY(paidTotal.toNumber())}
            </div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: "0.6875rem", textTransform: "uppercase" }}>
              Kalan
            </div>
            <div
              style={{
                color: remaining.lte(0) ? "#22c55e" : "#f59e0b",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {formatTRY(Math.max(remaining.toNumber(), 0))}
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Amount */}
          <div>
            <label
              htmlFor="payment-amount"
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Tutar (₺)
            </label>
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); }}
              placeholder={remaining.toFixed(2)}
              autoFocus
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Payment Date */}
          <div>
            <label
              htmlFor="payment-date"
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Ödeme Tarihi
            </label>
            <input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => { setPaymentDate(e.target.value); }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Method */}
          <div>
            <label
              htmlFor="payment-method"
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Ödeme Yöntemi
            </label>
            <select
              id="payment-method"
              value={method}
              onChange={(e) =>
                { setMethod(e.target.value as typeof method); }
              }
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.875rem",
              }}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label
              htmlFor="payment-reference"
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Referans (isteğe bağlı)
            </label>
            <input
              id="payment-reference"
              type="text"
              value={reference}
              onChange={(e) => { setReference(e.target.value); }}
              placeholder="Dekont no, çek no..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="payment-notes"
              style={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Notlar (isteğe bağlı)
            </label>
            <textarea
              id="payment-notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); }}
              rows={2}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={createMutation.isPending}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #334155",
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={!isValid || createMutation.isPending}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor:
                isValid && !createMutation.isPending ? "#3b82f6" : "#334155",
              color: isValid && !createMutation.isPending ? "#fff" : "#64748b",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor:
                isValid && !createMutation.isPending
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {createMutation.isPending
              ? "Kaydediliyor..."
              : `${directionLabel} Kaydet`}
          </button>
        </div>
      </form>
    </div>
  );
}
