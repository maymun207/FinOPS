"use client";

/**
 * Import Page — /dashboard/import
 *
 * Multi-step import wizard:
 *   Step 1: Upload Excel/CSV file
 *   Step 2: Select import type + map columns
 *   Step 3: Preview & confirm → queue to quarantine
 */
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/import/FileUploader";
import {
  ColumnMappingGrid,
  type MappingRow,
} from "@/components/import/ColumnMappingGrid";
import { MappingProfileSelector } from "@/components/import/MappingProfileSelector";
import { parseExcelFile, type ParseResult } from "@/lib/excel/parse";
import { generateColumnFingerprint } from "@/lib/excel/fingerprint";
import { trpc } from "@/lib/trpc/client";

type ImportType = "invoice" | "contact" | "journal";
type Step = "upload" | "mapping" | "preview";

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  invoice: "Fatura",
  contact: "Cari Kart",
  journal: "Yevmiye Kaydı",
};

export default function ImportPage() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<Step>("upload");
  const [importType, setImportType] = useState<ImportType>("invoice");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [mapping, setMapping] = useState<MappingRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);

  // tRPC mutation
  const queueMutation = trpc.import.parseAndQueue.useMutation({
    onSuccess: (result) => {
      router.push("/import/quarantine");
    },
  });

  // Step 1: File selected
  const handleFileSelected = useCallback(
    async (file: File, isLarge: boolean) => {
      if (isLarge) {
        // TODO: Upload to R2 via presigned URL for server-side processing
        alert("Büyük dosya desteği yakında eklenecek. Lütfen 4MB altında dosya yükleyin.");
        return;
      }

      setIsProcessing(true);
      try {
        const result = await parseExcelFile(file);
        setParseResult(result);

        // Generate fingerprint for auto-matching
        const sheet = result.sheets[0];
        if (sheet) {
          const fp = await generateColumnFingerprint(sheet.headers);
          setFingerprint(fp);
        }

        setStep("mapping");
      } catch (err) {
        console.error("Parse error:", err);
        alert("Dosya okunamadı. Lütfen geçerli bir Excel veya CSV dosyası yükleyin.");
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Step 2: Mapping changed
  const handleMappingChange = useCallback((newMapping: MappingRow[]) => {
    setMapping(newMapping);
  }, []);

  // Step 2: Profile loaded
  const handleProfileLoad = useCallback(
    (profileMapping: Array<{ sourceCol: string; targetField: string }>) => {
      setMapping(profileMapping);
    },
    []
  );

  // Step 3: Submit to quarantine
  const handleSubmit = useCallback(() => {
    if (!parseResult) return;

    const sheet = parseResult.sheets[sheetIndex];
    if (!sheet) return;

    // Apply column mapping: transform rows using the mapping
    const activeMappings = mapping.filter((m) => m.targetField);
    if (activeMappings.length === 0) {
      alert("En az bir sütun eşleştirmesi yapmalısınız.");
      return;
    }

    const mappedRows = sheet.rows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const m of activeMappings) {
        mapped[m.targetField] = row[m.sourceCol];
      }
      return mapped;
    });

    queueMutation.mutate({
      importType,
      rows: mappedRows,
    });
  }, [parseResult, sheetIndex, mapping, importType, queueMutation]);

  const currentSheet = parseResult?.sheets[sheetIndex];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>
          📥 Veri İçe Aktarma
        </h1>
        <p style={{ opacity: 0.6, fontSize: "14px", marginTop: "8px" }}>
          Excel veya CSV dosyasından veri içe aktarın
        </p>
      </div>

      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "32px",
          fontSize: "14px",
        }}
      >
        {(["upload", "mapping", "preview"] as Step[]).map((s, i) => {
          const labels = ["1. Dosya Yükle", "2. Sütun Eşleştir", "3. Önizle & Gönder"];
          const isActive = s === step;
          const isDone =
            (s === "upload" && step !== "upload") ||
            (s === "mapping" && step === "preview");

          return (
            <div
              key={s}
              style={{
                padding: "8px 20px",
                borderRadius: "9999px",
                fontWeight: isActive ? 700 : 400,
                background: isActive
                  ? "var(--accent, #6366f1)"
                  : isDone
                    ? "rgba(34, 197, 94, 0.15)"
                    : "rgba(255, 255, 255, 0.05)",
                color: isActive ? "white" : isDone ? "#22c55e" : "inherit",
                opacity: isActive || isDone ? 1 : 0.4,
              }}
            >
              {isDone ? "✓ " : ""}
              {labels[i]}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div>
          {/* Import type selector */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            >
              İçe Aktarma Türü
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(Object.entries(IMPORT_TYPE_LABELS) as [ImportType, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setImportType(key)}
                    style={{
                      padding: "10px 24px",
                      borderRadius: "8px",
                      border: `2px solid ${importType === key ? "var(--accent, #6366f1)" : "var(--border, #3f3f46)"}`,
                      background:
                        importType === key
                          ? "rgba(99, 102, 241, 0.1)"
                          : "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontWeight: importType === key ? 700 : 400,
                      fontSize: "14px",
                    }}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <FileUploader
            onFileSelected={handleFileSelected}
            disabled={isProcessing}
          />

          {isProcessing && (
            <p style={{ marginTop: "16px", opacity: 0.6 }}>
              ⏳ Dosya işleniyor...
            </p>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && currentSheet && (
        <div>
          {/* Sheet selector (if multiple sheets) */}
          {parseResult && parseResult.sheets.length > 1 && (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginRight: "12px",
                }}
              >
                Sayfa:
              </label>
              <select
                value={sheetIndex}
                onChange={(e) => setSheetIndex(parseInt(e.target.value, 10))}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #3f3f46)",
                  backgroundColor: "var(--bg-secondary, #27272a)",
                  color: "inherit",
                  fontSize: "14px",
                }}
              >
                {parseResult.sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name} ({s.rows.length} satır)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mapping profile selector */}
          <div style={{ marginBottom: "16px" }}>
            <MappingProfileSelector
              fingerprint={fingerprint}
              onProfileLoad={handleProfileLoad}
              currentMapping={mapping}
            />
          </div>

          {/* Mapping grid */}
          <ColumnMappingGrid
            sourceColumns={currentSheet.headers}
            importType={importType}
            initialMapping={mapping.length > 0 ? mapping : undefined}
            onChange={handleMappingChange}
          />

          {/* Navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "24px",
            }}
          >
            <button
              onClick={() => setStep("upload")}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid var(--border, #3f3f46)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ← Geri
            </button>
            <button
              onClick={() => setStep("preview")}
              disabled={mapping.filter((m) => m.targetField).length === 0}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent, #6366f1)",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                opacity:
                  mapping.filter((m) => m.targetField).length > 0 ? 1 : 0.5,
              }}
            >
              Önizle →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Submit */}
      {step === "preview" && currentSheet && (
        <div>
          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border, #3f3f46)",
              marginBottom: "24px",
            }}
          >
            <h3
              style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}
            >
              İçe Aktarma Özeti
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "16px",
                fontSize: "14px",
              }}
            >
              <div>
                <div style={{ opacity: 0.6, marginBottom: "4px" }}>Tür</div>
                <div style={{ fontWeight: 600 }}>
                  {IMPORT_TYPE_LABELS[importType]}
                </div>
              </div>
              <div>
                <div style={{ opacity: 0.6, marginBottom: "4px" }}>Satır Sayısı</div>
                <div style={{ fontWeight: 600 }}>{currentSheet.rows.length}</div>
              </div>
              <div>
                <div style={{ opacity: 0.6, marginBottom: "4px" }}>
                  Eşleşen Sütun
                </div>
                <div style={{ fontWeight: 600 }}>
                  {mapping.filter((m) => m.targetField).length} /{" "}
                  {currentSheet.headers.length}
                </div>
              </div>
            </div>

            {/* Mapped fields list */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ opacity: 0.6, fontSize: "13px", marginBottom: "8px" }}>
                Alan Eşleştirmeleri:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {mapping
                  .filter((m) => m.targetField)
                  .map((m) => (
                    <span
                      key={m.sourceCol}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "6px",
                        background: "rgba(99, 102, 241, 0.1)",
                        fontSize: "13px",
                      }}
                    >
                      {m.sourceCol} → {m.targetField}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={() => setStep("mapping")}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "1px solid var(--border, #3f3f46)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ← Geri
            </button>
            <button
              onClick={handleSubmit}
              disabled={queueMutation.isPending}
              style={{
                padding: "12px 32px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "white",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: 700,
                opacity: queueMutation.isPending ? 0.6 : 1,
              }}
            >
              {queueMutation.isPending
                ? "⏳ Gönderiliyor..."
                : `✓ ${currentSheet.rows.length} Satırı İçe Aktar`}
            </button>
          </div>

          {queueMutation.isError && (
            <p style={{ color: "#ef4444", marginTop: "12px", fontSize: "14px" }}>
              ⚠️ {queueMutation.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
