"use client";

/**
 * GIBRetryButton — Manual retry trigger for rejected GIB e-Fatura submissions.
 *
 * Only visible when gib_status === "rejected".
 * Calls gib.retry mutation and shows loading state.
 */
import React, { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface Props {
  invoiceId: string;
  gibStatus: string | null | undefined;
  /** Called after successful retry trigger */
  onRetryTriggered?: () => void;
}

export function GIBRetryButton({ invoiceId, gibStatus, onRetryTriggered }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const retryMutation = trpc.gib.retry.useMutation();

  const handleRetry = useCallback(async () => {
    setIsLoading(true);
    try {
      await retryMutation.mutateAsync({ invoiceId });
      onRetryTriggered?.();
    } catch (err) {
      console.error("GIB retry failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId, retryMutation, onRetryTriggered]);

  // Only show for rejected invoices
  if (gibStatus !== "rejected") return null;

  return (
    <button
      id="gib-retry-button"
      onClick={handleRetry}
      disabled={isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 6,
        border: "1px solid #7f1d1d",
        background: isLoading
          ? "rgba(127, 29, 29, 0.3)"
          : "linear-gradient(135deg, #7f1d1d, #991b1b)",
        color: "#fca5a5",
        fontSize: 12,
        fontWeight: 600,
        cursor: isLoading ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        opacity: isLoading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isLoading) e.currentTarget.style.opacity = "0.85";
      }}
      onMouseLeave={(e) => {
        if (!isLoading) e.currentTarget.style.opacity = "1";
      }}
    >
      {isLoading ? (
        <>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid #fca5a5",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Gönderiliyor...
        </>
      ) : (
        <>
          <span>🔄</span>
          Tekrar Gönder
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
