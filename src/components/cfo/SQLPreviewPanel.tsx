"use client";

/**
 * SQLPreviewPanel — Shows generated SQL with syntax highlighting.
 *
 * Features:
 *   - CSS-based SQL keyword highlighting
 *   - AI explanation text
 *   - "Sorguyu Çalıştır" (Run) + "İptal" (Cancel) action buttons
 *   - Dark theme to match BaseGrid
 */
import React, { useMemo } from "react";

interface Props {
  sql: string;
  explanation?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Simple SQL keyword highlighting with <span> wrapping
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "ON", "AND", "OR", "NOT", "IN", "AS", "GROUP", "BY", "ORDER", "HAVING",
  "LIMIT", "OFFSET", "CASE", "WHEN", "THEN", "ELSE", "END", "WITH",
  "UNION", "ALL", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "CAST", "COALESCE", "NULL", "IS", "BETWEEN", "LIKE", "ILIKE", "EXISTS",
  "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "VALUES",
  "ASC", "DESC", "OVER", "PARTITION", "TRUE", "FALSE",
];

function highlightSQL(raw: string): string {
  // Escape HTML
  let html = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight string literals
  html = html.replace(
    /'[^']*'/g,
    (match) => `<span style="color:#a5d6a7">${match}</span>`,
  );

  // Highlight numbers
  html = html.replace(
    /\b(\d+\.?\d*)\b/g,
    (match) => `<span style="color:#ce93d8">${match}</span>`,
  );

  // Highlight keywords (case-insensitive)
  const keywordPattern = new RegExp(`\\b(${SQL_KEYWORDS.join("|")})\\b`, "gi");
  html = html.replace(
    keywordPattern,
    (match) => `<span style="color:#64b5f6;font-weight:600">${match.toUpperCase()}</span>`,
  );

  // Highlight $1, $2 params
  html = html.replace(
    /\$\d+/g,
    (match) => `<span style="color:#ffb74d">${match}</span>`,
  );

  // Highlight comments
  html = html.replace(
    /--.*$/gm,
    (match) => `<span style="color:#78909c;font-style:italic">${match}</span>`,
  );

  return html;
}

export function SQLPreviewPanel({ sql: sqlText, explanation, onConfirm, onCancel }: Props) {
  const highlighted = useMemo(() => highlightSQL(sqlText), [sqlText]);

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

      {/* SQL Code */}
      <pre
        style={{
          padding: 16,
          margin: 0,
          overflowX: "auto",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          color: "#e2e8f0",
        }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />

      {/* Explanation */}
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
