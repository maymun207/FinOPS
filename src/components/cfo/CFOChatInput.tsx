"use client";

/**
 * CFOChatInput — Question input with send button.
 *
 * Features:
 *   - Turkish placeholder text
 *   - Enter to send, Shift+Enter for newline
 *   - Disabled during loading state
 *   - Premium dark-themed design matching the app style
 */
import React, { useState, useCallback, useRef, useEffect } from "react";

interface Props {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export function CFOChatInput({ onSubmit, disabled = false }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120).toString()}px`;
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        padding: 16,
        background: "#1e293b",
        borderRadius: 12,
        border: "1px solid #334155",
      }}
    >
      <textarea
        ref={textareaRef}
        id="cfo-question-input"
        value={value}
        onChange={(e) => { setValue(e.target.value); }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Finansal sorunuzu yazın... (ör. 'Bu dönemde toplam KDV ne kadar?')"
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #475569",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          lineHeight: "1.5",
          outline: "none",
          transition: "border-color 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#475569")}
      />
      <button
        id="cfo-send-button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          background:
            disabled || !value.trim()
              ? "#334155"
              : "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: disabled || !value.trim() ? "#64748b" : "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 16 }}>🔍</span>
        Sor
      </button>
    </div>
  );
}
