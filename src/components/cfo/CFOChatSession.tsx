"use client";

/**
 * CFOChatSession — State machine orchestrator for the Virtual CFO chat flow.
 *
 * States:
 *   IDLE → GENERATING → AWAITING_CONFIRMATION → COMPLETE (or ERROR at any stage)
 *
 * Option 1 flow: Vanna inference already returns rows, so we skip a separate
 * EXECUTING state. User confirms → rows are revealed from the cached output.
 */
import React, { useReducer, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { CFOChatInput } from "./CFOChatInput";
import { SQLPreviewPanel } from "./SQLPreviewPanel";
import { CFOResultsGrid } from "./CFOResultsGrid";
import { CFOResultChart } from "./CFOResultChart";
import { CFOFeedback } from "./CFOFeedback";
import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues with AG Grid
const ResultsGrid = dynamic(
  () => import("./CFOResultsGrid").then((m) => ({ default: m.CFOResultsGrid })),
  { ssr: false },
);
const ResultChart = dynamic(
  () => import("./CFOResultChart").then((m) => ({ default: m.CFOResultChart })),
  { ssr: false },
);

// ── State Machine Types ─────────────────────────────────────────────

type ChatState =
  | { phase: "IDLE" }
  | { phase: "GENERATING"; runId: string; question: string }
  | {
      phase: "AWAITING_CONFIRMATION";
      question: string;
      sql: string;
      rows: Record<string, unknown>[];
      rowCount: number;
      latencyMs: number;
    }
  | {
      phase: "COMPLETE";
      question: string;
      sql: string;
      rows: Record<string, unknown>[];
      rowCount: number;
      latencyMs: number;
    }
  | { phase: "ERROR"; message: string; question?: string };

type ChatAction =
  | { type: "ASK"; runId: string; question: string }
  | {
      type: "INFERENCE_DONE";
      question: string;
      sql: string;
      rows: Record<string, unknown>[];
      rowCount: number;
      latencyMs: number;
    }
  | { type: "INFERENCE_REJECTED"; reason: string; question: string }
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "ERROR"; message: string; question?: string }
  | { type: "RESET" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ASK":
      return { phase: "GENERATING", runId: action.runId, question: action.question };

    case "INFERENCE_DONE":
      return {
        phase: "AWAITING_CONFIRMATION",
        question: action.question,
        sql: action.sql,
        rows: action.rows,
        rowCount: action.rowCount,
        latencyMs: action.latencyMs,
      };

    case "INFERENCE_REJECTED":
      return {
        phase: "ERROR",
        message: `SQL güvenlik kontrolünden geçemedi: ${action.reason}`,
        question: action.question,
      };

    case "CONFIRM":
      if (state.phase !== "AWAITING_CONFIRMATION") return state;
      return {
        phase: "COMPLETE",
        question: state.question,
        sql: state.sql,
        rows: state.rows,
        rowCount: state.rowCount,
        latencyMs: state.latencyMs,
      };

    case "CANCEL":
      return { phase: "IDLE" };

    case "ERROR":
      return { phase: "ERROR", message: action.message, question: action.question };

    case "RESET":
      return { phase: "IDLE" };

    default:
      return state;
  }
}

// ── Component ───────────────────────────────────────────────────────

export function CFOChatSession() {
  const [state, dispatch] = useReducer(chatReducer, { phase: "IDLE" });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const askMutation = trpc.cfo.ask.useMutation();
  const approveMutation = trpc.cfo.approve.useMutation();

  // We can't use useQuery with polling directly because refetchInterval
  // needs the runId. Instead we'll use the trpc client utility.
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
            dispatch({
              type: "INFERENCE_REJECTED",
              reason: result.output.reason ?? "Bilinmeyen hata",
              question,
            });
          } else {
            dispatch({
              type: "INFERENCE_DONE",
              question: result.output.question,
              sql: result.output.sql,
              rows: result.output.rows,
              rowCount: result.output.rowCount ?? 0,
              latencyMs: result.output.latencyMs,
            });
          }
        } else if (result.status === "failed") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          dispatch({
            type: "ERROR",
            message: result.error ?? "Görev başarısız oldu",
            question,
          });
        }
        // status === "running" → keep polling
      } catch (err) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        dispatch({
          type: "ERROR",
          message: err instanceof Error ? err.message : "Bağlantı hatası",
          question,
        });
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [state.phase, state.phase === "GENERATING" ? state.runId : null, utils]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleAsk = useCallback(
    async (question: string) => {
      try {
        const result = await askMutation.mutateAsync({ question });
        dispatch({ type: "ASK", runId: result.runId, question });
      } catch (err) {
        dispatch({
          type: "ERROR",
          message: err instanceof Error ? err.message : "Soru gönderilemedi",
          question,
        });
      }
    },
    [askMutation],
  );

  const handleConfirm = useCallback(() => {
    dispatch({ type: "CONFIRM" });
  }, []);

  const handleCancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, []);

  const handleApprove = useCallback(
    (question: string, sql: string) => {
      approveMutation.mutate({ question, sql });
    },
    [approveMutation],
  );

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

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
            explanation={`Bu sorgu ${state.rowCount} satır döndürdü.`}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
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
              onClick={handleReset}
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
          <ResultChart rows={state.rows} />

          {/* Results grid */}
          <ResultsGrid rows={state.rows} height="400px" />

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
            onClick={handleReset}
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
