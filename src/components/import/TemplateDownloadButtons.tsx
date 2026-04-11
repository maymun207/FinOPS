"use client";

/**
 * TemplateDownloadButtons — three .xlsx template download buttons.
 *
 * Placed at the top of /import before the file upload area.
 * Each button generates a pre-formatted Excel file client-side using ExcelJS
 * and triggers a browser download immediately.
 *
 * Uses ExcelJS browser APIs — must remain a client component.
 */
import React, { useState } from "react";
import {
  downloadInvoiceTemplate,
  downloadContactTemplate,
  downloadJournalTemplate,
} from "@/lib/excel/templates";

type TemplateKey = "invoice" | "contact" | "journal";

interface TemplateConfig {
  key: TemplateKey;
  label: string;
  sublabel: string;
  iconPath: string;
  accentColor: string;
  download: () => Promise<void>;
}

const TEMPLATES: TemplateConfig[] = [
  {
    key: "invoice",
    label: "Fatura Şablonu",
    sublabel: "Alış & satış faturaları",
    iconPath:
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    accentColor: "#6366f1",
    download: downloadInvoiceTemplate,
  },
  {
    key: "contact",
    label: "Cari Şablon",
    sublabel: "Müşteri & tedarikçi kartları",
    iconPath:
      "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    accentColor: "#0ea5e9",
    download: downloadContactTemplate,
  },
  {
    key: "journal",
    label: "Yevmiye Şablonu",
    sublabel: "Çift taraflı muhasebe kayıtları",
    iconPath:
      "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20 M9 10h6 M9 14h4",
    accentColor: "#22c55e",
    download: downloadJournalTemplate,
  },
];

export function TemplateDownloadButtons() {
  const [loading, setLoading] = useState<TemplateKey | null>(null);
  const [downloaded, setDownloaded] = useState<Set<TemplateKey>>(new Set());

  const handleDownload = async (tpl: TemplateConfig) => {
    if (loading) return;
    setLoading(tpl.key);
    try {
      await tpl.download();
      setDownloaded((prev) => new Set([...prev, tpl.key]));
    } catch (err) {
      console.error("Template download failed:", err);
      alert("Şablon indirilemedi. Lütfen tekrar deneyin.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      style={{
        padding: "20px 24px",
        marginBottom: "28px",
        borderRadius: "12px",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#e2e8f0" }}>
            Şablon İndir
          </span>
        </div>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
          Verilerinizi doğru formatta girmek için şablonu indirin, doldurun ve yükleyin.
        </p>
      </div>

      {/* Button row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {TEMPLATES.map((tpl) => {
          const isLoading = loading === tpl.key;
          const isDone = downloaded.has(tpl.key);

          return (
            <button
              key={tpl.key}
              id={`download-template-${tpl.key}`}
              onClick={() => void handleDownload(tpl)}
              disabled={isLoading || !!loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: `1.5px solid ${isDone ? tpl.accentColor + "60" : "rgba(255,255,255,0.08)"}`,
                backgroundColor: isDone
                  ? `${tpl.accentColor}12`
                  : "rgba(255,255,255,0.04)",
                color: "#e2e8f0",
                cursor: loading ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.18s ease",
                opacity: loading && !isLoading ? 0.5 : 1,
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = `${tpl.accentColor}18`;
                  e.currentTarget.style.borderColor = `${tpl.accentColor}80`;
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = isDone
                    ? `${tpl.accentColor}12`
                    : "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = isDone
                    ? `${tpl.accentColor}60`
                    : "rgba(255,255,255,0.08)";
                }
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  backgroundColor: `${tpl.accentColor}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background-color 0.18s",
                }}
              >
                {isLoading ? (
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tpl.accentColor}
                    strokeWidth={2.5}
                    style={{ animation: "tpl-spin 0.9s linear infinite" }}
                  >
                    <path d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                ) : isDone ? (
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tpl.accentColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tpl.accentColor}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tpl.iconPath} />
                  </svg>
                )}
              </div>

              {/* Text */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: isDone ? tpl.accentColor : "#e2e8f0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isLoading
                    ? "Hazırlanıyor..."
                    : isDone
                      ? "İndirildi ✓"
                      : `${tpl.label} İndir`}
                </div>
                <div
                  style={{
                    fontSize: "11.5px",
                    color: "#64748b",
                    marginTop: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tpl.sublabel}
                </div>
              </div>

              {/* Download arrow (only when idle) */}
              {!isLoading && !isDone && (
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#475569"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes tpl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
