"use client";

/**
 * CFOChatSession — State machine orchestrator for the Virtual CFO chat flow.
 *
 * Uses Zustand store (persists across page navigations within the same session).
 * States: IDLE → GENERATING → AWAITING_CONFIRMATION → COMPLETE (or ERROR)
 *
 * Option 1 flow: Vanna inference already returns rows, so we skip a separate
 * EXECUTING state. User confirms → rows are revealed from the cached output.
 *
 * TanStack Query retry: 0 — each retry would consume Gemini API credits.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { useCFOStore } from "@/lib/cfo/cfo-store";
import { CFOChatInput } from "./CFOChatInput";
import { SQLPreviewPanel } from "./SQLPreviewPanel";
import { CFOFeedback } from "./CFOFeedback";
import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues with AG Grid / ECharts
const CFOResultsGrid = dynamic(
  () => import("./CFOResultsGrid").then((m) => ({ default: m.CFOResultsGrid })),
  { ssr: false },
);
const CFOResultChart = dynamic(
  () => import("./CFOResultChart").then((m) => ({ default: m.CFOResultChart })),
  { ssr: false },
);

export function CFOChatSession() {
  const { state, ask, inferenceDone, inferenceRejected, confirm, cancel, error, reset } =
    useCFOStore();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // retry: 0 — each retry would consume Gemini API credits
  const askMutation = trpc.cfo.ask.useMutation({ retry: false });
  const approveMutation = trpc.cfo.approve.useMutation();
  const utils = trpc.useUtils();

  // ── Polling for inference result ──────────────────────────────────

  useEffect(() => {
    if (state.phase !== "GENERATING") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const runId = state.runId;
    const question = state.question;

    pollingRef.current = setInterval(async () => {
      try {
        const result = await utils.cfo.getRunResult.fetch({ runId });

        if (result.status === "completed" && result.output) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;

          if (result.output.status === "rejected") {
            inferenceRejected(
              question,
              result.output.reason ?? "Bilinmeyen hata",
            );
          } else {
            inferenceDone({
              question: result.output.question,
              sql: result.output.sql,
              explanation: result.output.explanation ?? "",
              rows: result.output.rows,
              rowCount: result.output.rowCount ?? 0,
              latencyMs: result.output.latencyMs,
            });
          }
        } else if (result.status === "failed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          error(result.error ?? "Görev başarısız oldu", question);
        }
        // status === "running" → keep polling
      } catch (err) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        error(
          err instanceof Error ? err.message : "Bağlantı hatası",
          question,
        );
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [state.phase, state.phase === "GENERATING" ? state.runId : null, utils, inferenceDone, inferenceRejected, error]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleAsk = useCallback(
    async (question: string) => {
      try {
        const result = await askMutation.mutateAsync({ question });
        ask(result.runId, question);
      } catch (err) {
        error(
          err instanceof Error ? err.message : "Soru gönderilemedi",
          question,
        );
      }
    },
    [askMutation, ask, error],
  );

  const handleApprove = useCallback(
    (question: string, sql: string) => {
      approveMutation.mutate({ question, sql });
    },
    [approveMutation],
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      id="cfo-chat-session"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Input — always visible */}
      <CFOChatInput
        onSubmit={handleAsk}
        disabled={state.phase === "GENERATING"}
      />

      {/* GENERATING — spinner */}
      {state.phase === "GENERATING" && (
        <div
          id="cfo-generating"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 20,
            background: "#1e293b",
            borderRadius: 12,
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "3px solid #334155",
              borderTopColor: "#3b82f6",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>
              Yapay zeka düşünüyor...
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
              SQL oluşturuluyor ve çalıştırılıyor
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* AWAITING_CONFIRMATION — SQL preview */}
      {state.phase === "AWAITING_CONFIRMATION" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            <span>❓</span>
            <span style={{ fontWeight: 500 }}>{state.question}</span>
            <span style={{ color: "#64748b", fontSize: 11 }}>
              ({state.latencyMs}ms)
            </span>
          </div>
          <SQLPreviewPanel
            sql={state.sql}
            explanation={state.explanation || undefined}
            onConfirm={confirm}
            onCancel={cancel}
          />
        </div>
      )}

      {/* COMPLETE — results + chart + feedback */}
      {state.phase === "COMPLETE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Question recap */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>✅</span>
              <span style={{ fontWeight: 500 }}>{state.question}</span>
            </div>
            <button
              onClick={reset}
              style={{
                fontSize: 12,
                color: "#64748b",
                background: "transparent",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              Yeni Soru
            </button>
          </div>

          {/* Auto-chart (renders nothing for table_only) */}
          <CFOResultChart rows={state.rows} />

          {/* Results grid */}
          <CFOResultsGrid rows={state.rows} height="400px" />

          {/* Feedback */}
          <CFOFeedback
            question={state.question}
            sql={state.sql}
            onApprove={handleApprove}
          />
        </div>
      )}

      {/* ERROR */}
      {state.phase === "ERROR" && (
        <div
          id="cfo-error"
          style={{
            padding: 16,
            background: "#1c1917",
            borderRadius: 12,
            border: "1px solid #7f1d1d",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fca5a5" }}>
              Hata Oluştu
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>
            {state.message}
          </div>
          {state.question && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Soru: &quot;{state.question}&quot;
            </div>
          )}
          <button
            onClick={reset}
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #475569",
              background: "transparent",
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}
