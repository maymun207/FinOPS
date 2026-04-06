"use client";

/**
 * CFOFeedback — Thumbs up/down feedback buttons.
 *
 * - Thumbs up → calls cfo.approve mutation (adds Q&A pair to training corpus)
 * - Thumbs down → dismisses (no action, optional negative feedback later)
 */
import React, { useState } from "react";

interface Props {
  question: string;
  sql: string;
  onApprove: (question: string, sql: string) => void;
}

export function CFOFeedback({ question, sql, onApprove }: Props) {
  const [state, setState] = useState<"idle" | "approved" | "rejected">("idle");

  if (state === "approved") {
    return (
      <div
        id="cfo-feedback-approved"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "#052e16",
          borderRadius: 8,
          border: "1px solid #166534",
          fontSize: 13,
          color: "#4ade80",
        }}
      >
        <span>✅</span>
        Teşekkürler! Bu soru-cevap çifti eğitim verilerine eklendi.
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div
        id="cfo-feedback-rejected"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "#1e293b",
          borderRadius: 8,
          border: "1px solid #334155",
          fontSize: 13,
          color: "#94a3b8",
        }}
      >
        <span>💬</span>
        Geri bildiriminiz için teşekkürler.
      </div>
    );
  }

  return (
    <div
      id="cfo-feedback"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "#1e293b",
        borderRadius: 8,
        border: "1px solid #334155",
      }}
    >
      <span style={{ fontSize: 13, color: "#94a3b8" }}>
        Bu sonuç faydalı oldu mu?
      </span>
      <button
        id="cfo-thumbs-up"
        onClick={() => {
          setState("approved");
          onApprove(question, sql);
        }}
        style={{
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid #334155",
          background: "transparent",
          color: "#4ade80",
          fontSize: 13,
          cursor: "pointer",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#052e16";
          e.currentTarget.style.borderColor = "#166534";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "#334155";
        }}
      >
        <span>👍</span> Evet
      </button>
      <button
        id="cfo-thumbs-down"
        onClick={() => setState("rejected")}
        style={{
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid #334155",
          background: "transparent",
          color: "#f87171",
          fontSize: 13,
          cursor: "pointer",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#1c1917";
          e.currentTarget.style.borderColor = "#7f1d1d";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "#334155";
        }}
      >
        <span>👎</span> Hayır
      </button>
    </div>
  );
}
