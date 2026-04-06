"use client";

/**
 * SQLPreviewPanel — Shows generated SQL with syntax highlighting.
 *
 * Features:
 *   - react-syntax-highlighter with SQL language + dark theme
 *   - AI explanation text (natural language summary from Gemini)
 *   - "Sorguyu Çalıştır" (Run) + "İptal" (Cancel) action buttons
 *   - Read-only SQL — user cannot edit
 */
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  sql: string;
  explanation?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SQLPreviewPanel({ sql: sqlText, explanation, onConfirm, onCancel }: Props) {
  return (
    <div
      id="cfo-sql-preview"
      style={{
        background: "#0f172a",
        borderRadius: 12,
        border: "1px solid #334155",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#1e293b",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Üretilen SQL
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            background: "#0f172a",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Onayınızı bekliyor
        </div>
      </div>

      {/* SQL Code — react-syntax-highlighter, read-only */}
      <div style={{ fontSize: 13 }}>
        <SyntaxHighlighter
          language="sql"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 16,
            background: "#0f172a",
            borderRadius: 0,
            fontSize: 13,
            lineHeight: 1.6,
          }}
          showLineNumbers={false}
          wrapLines={true}
          wrapLongLines={true}
        >
          {sqlText}
        </SyntaxHighlighter>
      </div>

      {/* AI Explanation */}
      {explanation && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1e293b",
            fontSize: 13,
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "#60a5fa" }}>💡 Açıklama: </span>
          {explanation}
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 16px",
          borderTop: "1px solid #334155",
          background: "#1e293b",
        }}
      >
        <button
          id="cfo-run-query"
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <span>▶</span> Sorguyu Çalıştır
        </button>
        <button
          id="cfo-cancel-query"
          onClick={onCancel}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #475569",
            background: "transparent",
            color: "#94a3b8",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#ef4444";
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#475569";
            e.currentTarget.style.color = "#94a3b8";
          }}
        >
          İptal
        </button>
      </div>
    </div>
  );
}
