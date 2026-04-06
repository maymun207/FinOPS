"use client";

/**
 * FileUploader — Drag-and-drop file input for Excel/CSV uploads.
 *
 * Features:
 *   - Drag-and-drop zone with visual feedback
 *   - Click to browse fallback
 *   - File size routing: ≤4MB parsed in-browser, >4MB queued server-side
 *   - Accepts .xlsx, .xls, .csv
 *   - Shows file metadata after selection
 */
import React, { useCallback, useState, useRef } from "react";

const LARGE_FILE_THRESHOLD = 4 * 1024 * 1024; // 4MB

const _ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
];

const ACCEPTED_EXTENSIONS = ".xlsx,.xls,.csv";

interface FileUploaderProps {
  onFileSelected: (file: File, isLarge: boolean) => void;
  disabled?: boolean;
  maxSizeMB?: number;
}

export function FileUploader({
  onFileSelected,
  disabled = false,
  maxSizeMB = 50,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      // Validate type
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
        setError("Desteklenmeyen dosya formatı. Lütfen .xlsx, .xls veya .csv yükleyin.");
        return;
      }

      // Validate size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`Dosya boyutu çok büyük (max ${String(maxSizeMB)}MB).`);
        return;
      }

      const isLarge = file.size > LARGE_FILE_THRESHOLD;
      setSelectedFile(file);
      onFileSelected(file, isLarge);
    },
    [onFileSelected, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${isDragOver ? "var(--accent, #6366f1)" : error ? "#ef4444" : "var(--border, #3f3f46)"}`,
          borderRadius: "12px",
          padding: "48px 24px",
          textAlign: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          backgroundColor: isDragOver
            ? "rgba(99, 102, 241, 0.08)"
            : "rgba(255, 255, 255, 0.02)",
          transition: "all 0.2s ease",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.6 }}>
          📁
        </div>

        <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
          {isDragOver
            ? "Dosyayı bırakın..."
            : "Excel veya CSV dosyanızı sürükleyin"}
        </p>
        <p style={{ fontSize: "14px", opacity: 0.6, marginBottom: "4px" }}>
          veya <span style={{ color: "var(--accent, #6366f1)", textDecoration: "underline" }}>dosya seçin</span>
        </p>
        <p style={{ fontSize: "12px", opacity: 0.4 }}>
          .xlsx, .xls, .csv — Maks. {maxSizeMB}MB
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {/* Error message */}
      {error && (
        <p style={{ color: "#ef4444", fontSize: "14px", marginTop: "8px" }}>
          ⚠️ {error}
        </p>
      )}

      {/* Selected file info */}
      {selectedFile && !error && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px",
          }}
        >
          <span>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{selectedFile.name}</div>
            <div style={{ opacity: 0.6, fontSize: "12px" }}>
              {formatSize(selectedFile.size)}
              {selectedFile.size > LARGE_FILE_THRESHOLD && (
                <span style={{ color: "#eab308", marginLeft: "8px" }}>
                  ⚡ Büyük dosya — sunucuda işlenecek
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              opacity: 0.6,
              color: "inherit",
            }}
            aria-label="Dosyayı kaldır"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
