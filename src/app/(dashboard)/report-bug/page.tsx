"use client";

import React, { useState } from "react";

const CATEGORIES = [
  "Arayüz (UI)",
  "Veri / Raporlar",
  "AI Mali Müşavir",
  "İçe Aktarım",
  "Faturalar",
  "Genel",
];

const SEVERITIES = [
  { value: "low", label: "Düşük", color: "#22c55e" },
  { value: "medium", label: "Orta", color: "#f59e0b" },
  { value: "high", label: "Yüksek", color: "#f97316" },
  { value: "critical", label: "Kritik", color: "#ef4444" },
];

export default function ReportBugPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim() && category && severity && description.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    // Simulate submission delay
    await new Promise((r) => setTimeout(r, 1200));

    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          gap: "1.5rem",
          padding: "2rem",
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          Hata Raporu Gönderildi
        </h2>
        <p style={{ color: "#94a3b8", textAlign: "center", maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
          Geri bildiriminiz için teşekkür ederiz. Ekibimiz en kısa sürede inceleyecek.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setTitle("");
            setCategory("");
            setSeverity("");
            setDescription("");
            setSteps("");
          }}
          style={{
            marginTop: "0.5rem",
            padding: "0.625rem 1.5rem",
            borderRadius: "0.5rem",
            border: "1px solid #1e293b",
            backgroundColor: "#1e293b",
            color: "#e2e8f0",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#334155";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1e293b";
          }}
        >
          Yeni Rapor Gönder
        </button>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "0.75rem",
              background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2L7 6h10l-3-4 M12 6v6 M5.5 10l-1.5 2 M18.5 10l1.5 2 M5 16l-1.5 2 M19 16l1.5 2 M7 12a5 5 0 0 0 10 0v-2H7v2z M7 16h10" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
              Hata Bildir
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: 0 }}>
              Karşılaştığınız sorunu bize bildirin
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Başlık <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kısa bir açıklama yazın..."
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,189,248,0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Category + Severity row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Category */}
          <div>
            <label style={labelStyle}>
              Kategori <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#1e293b"; }}
            >
              <option value="" disabled>Seçiniz...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label style={labelStyle}>
              Öncelik <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {SEVERITIES.map((s) => {
                const selected = severity === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.25rem",
                      borderRadius: "0.5rem",
                      border: `1.5px solid ${selected ? s.color : "#1e293b"}`,
                      backgroundColor: selected ? `${s.color}18` : "#0f172a",
                      color: selected ? s.color : "#64748b",
                      fontSize: "0.6875rem",
                      fontWeight: selected ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) {
                        e.currentTarget.style.borderColor = s.color;
                        e.currentTarget.style.color = s.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) {
                        e.currentTarget.style.borderColor = "#1e293b";
                        e.currentTarget.style.color = "#64748b";
                      }
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>
            Açıklama <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hatayı detaylıca açıklayın..."
            rows={5}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,189,248,0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Steps to reproduce */}
        <div>
          <label style={labelStyle}>
            Yeniden Oluşturma Adımları
          </label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"1. ... sayfasına gidin\n2. ... butonuna tıklayın\n3. Hata oluşur"}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,189,248,0.1)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            style={{
              padding: "0.625rem 2rem",
              borderRadius: "0.5rem",
              border: "none",
              background: canSubmit
                ? "linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
                : "#1e293b",
              color: canSubmit ? "#fff" : "#475569",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              opacity: submitting ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {submitting && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                <path d="M12 2a10 10 0 1 0 10 10" />
              </svg>
            )}
            {submitting ? "Gönderiliyor..." : "Raporu Gönder"}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.375rem",
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid #1e293b",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  fontSize: "0.875rem",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
};
