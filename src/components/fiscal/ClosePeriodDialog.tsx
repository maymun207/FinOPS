"use client";

/**
 * ClosePeriodDialog — Hard confirmation dialog for closing a fiscal period.
 *
 * SAFETY PATTERN: The user must type the exact period name (e.g., "2024-03")
 * before the "Kapat" button becomes active. This prevents accidental closures.
 * The server also validates the confirmation string.
 */
import React, { useState } from "react";

interface ClosePeriodDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Period name the user must type to confirm */
  periodName: string;
  /** Period ID for the mutation */
  periodId: string;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Called when confirmed — passes (periodId, confirmation) */
  onConfirm: (periodId: string, confirmation: string) => void;
  /** Called when cancelled */
  onCancel: () => void;
}

export function ClosePeriodDialog({
  isOpen,
  periodName,
  periodId,
  isLoading,
  onConfirm,
  onCancel,
}: ClosePeriodDialogProps) {
  const [typed, setTyped] = useState("");

  if (!isOpen) return null;

  const isMatch = typed === periodName;

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm(periodId, typed);
      setTyped("");
    }
  };

  const handleCancel = () => {
    setTyped("");
    onCancel();
  };

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
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          maxWidth: "450px",
          width: "90%",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Warning header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              fontSize: "1.5rem",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⚠️
          </span>
          <div>
            <h3
              style={{
                color: "#e2e8f0",
                fontSize: "1.125rem",
                fontWeight: 700,
                margin: 0,
              }}
            >
              Dönem Kapatma
            </h3>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.8125rem",
                margin: "0.25rem 0 0 0",
              }}
            >
              Bu işlem geri alınamaz
            </p>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            marginBottom: "1.25rem",
          }}
        >
          <p
            style={{
              color: "#e2e8f0",
              fontSize: "0.875rem",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#ef4444" }}>&quot;{periodName}&quot;</strong>{" "}
            dönemini kapatmak üzeresiniz. Kapatılan döneme yeni
            yevmiye kaydı veya fatura girilemez.
          </p>
        </div>

        {/* Confirmation input */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              color: "#94a3b8",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "0.375rem",
            }}
          >
            Onaylamak için dönem adını yazın:{" "}
            <strong style={{ color: "#e2e8f0" }}>{periodName}</strong>
          </label>
          <input
            id="close-period-confirmation"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={periodName}
            autoFocus
            style={{
              width: "100%",
              padding: "0.625rem 0.75rem",
              borderRadius: "0.5rem",
              border: `1px solid ${isMatch ? "#22c55e" : "#334155"}`,
              backgroundColor: "#0f172a",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              fontFamily: "Inter, system-ui, sans-serif",
              outline: "none",
              transition: "border-color 0.2s",
            }}
          />
          {typed.length > 0 && !isMatch && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "0.75rem",
                margin: "0.375rem 0 0 0",
              }}
            >
              Dönem adı eşleşmiyor
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #334155",
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isLoading}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor:
                isMatch && !isLoading ? "#ef4444" : "#334155",
              color: isMatch && !isLoading ? "#fff" : "#64748b",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: isMatch && !isLoading ? "pointer" : "not-allowed",
              fontFamily: "Inter, system-ui, sans-serif",
              transition: "background-color 0.2s",
            }}
          >
            {isLoading ? "Kapatılıyor..." : "Dönemi Kapat"}
          </button>
        </div>
      </div>
    </div>
  );
}
