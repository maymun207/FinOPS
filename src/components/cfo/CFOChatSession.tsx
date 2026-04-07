"use client";

/**
 * CFOChatSession — Virtual CFO chat interface.
 *
 * Direct mutation mode: cfo.ask returns the full result immediately.
 * No polling, no runId — Gemini inference runs inline on the server.
 *
 * States: IDLE → GENERATING (loading spinner) → AWAITING_CONFIRMATION → COMPLETE | ERROR
 */
import React, { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { CFOChatInput } from "./CFOChatInput";
import { SQLPreviewPanel } from "./SQLPreviewPanel";
import { CFOFeedback } from "./CFOFeedback";
import dynamic from "next/dynamic";

const CFOResultsGrid = dynamic(
  () => import("./CFOResultsGrid").then((m) => ({ default: m.CFOResultsGrid })),
  { ssr: false },
);
const CFOResultChart = dynamic(
  () => import("./CFOResultChart").then((m) => ({ default: m.CFOResultChart })),
  { ssr: false },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "IDLE" | "GENERATING" | "AWAITING_CONFIRMATION" | "COMPLETE" | "ERROR";

interface CFOResult {
  status: "success" | "rejected";
  question: string;
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  latencyMs: number;
  reason?: string;
}

interface CFOState {
  phase: Phase;
  question: string;
  result: CFOResult | null;
  errorMsg: string;
}

const INITIAL_STATE: CFOState = {
  phase: "IDLE",
  question: "",
  result: null,
  errorMsg: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CFOChatSession() {
  const [state, setState] = useState(INITIAL_STATE);

  const askMutation = trpc.cfo.ask.useMutation({ retry: false });
  const approveMutation = trpc.cfo.approve.useMutation();

  const reset = useCallback(() => { setState(INITIAL_STATE); }, []);

  const handleAsk = useCallback(async (question: string) => {
    setState({ phase: "GENERATING", question, result: null, errorMsg: "" });

    try {
      const result = await askMutation.mutateAsync({ question });

      if (result.status === "rejected") {
        setState({
          phase: "ERROR",
          question,
          result: null,
          errorMsg: result.reason || "Sorgu oluşturulamadı veya güvensiz bulundu",
        });
        return;
      }

      setState({
        phase: "AWAITING_CONFIRMATION",
        question,
        result: result as CFOResult,
        errorMsg: "",
      });
    } catch (err) {
      setState({
        phase: "ERROR",
        question,
        result: null,
        errorMsg: err instanceof Error ? err.message : "Soru gönderilemedi",
      });
    }
  }, [askMutation]);

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "COMPLETE" }));
  }, []);

  const handleCancel = useCallback(() => { reset(); }, [reset]);

  const handleApprove = useCallback((question: string, sqlStr: string) => {
    approveMutation.mutate({ question, sql: sqlStr });
  }, [approveMutation]);

  return (
    <div id="cfo-chat-session" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

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
            display: "flex", alignItems: "center", gap: 12,
            padding: 20, background: "#1e293b",
            borderRadius: 12, border: "1px solid #334155",
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "3px solid #334155", borderTopColor: "#3b82f6",
            animation: "spin 0.8s linear infinite",
          }} />
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
      {state.phase === "AWAITING_CONFIRMATION" && state.result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8" }}>
            <span>❓</span>
            <span style={{ fontWeight: 500 }}>{state.question}</span>
            <span style={{ color: "#64748b", fontSize: 11 }}>({state.result.latencyMs}ms)</span>
          </div>
          <SQLPreviewPanel
            sql={state.result.sql}
            explanation={state.result.explanation || undefined}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* COMPLETE — results + chart + feedback */}
      {state.phase === "COMPLETE" && state.result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8,
            fontSize: 13, color: "#94a3b8",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>✅</span>
              <span style={{ fontWeight: 500 }}>{state.question}</span>
              <span style={{ color: "#64748b", fontSize: 11 }}>
                {state.result.rowCount} satır · {state.result.latencyMs}ms
              </span>
            </div>
            <button
              onClick={reset}
              style={{
                fontSize: 12, color: "#64748b", background: "transparent",
                border: "1px solid #334155", borderRadius: 6,
                padding: "4px 10px", cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e8f0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
            >
              Yeni Soru
            </button>
          </div>

          <CFOResultChart rows={state.result.rows} />
          <CFOResultsGrid rows={state.result.rows} height="400px" />
          <CFOFeedback
            question={state.question}
            sql={state.result.sql}
            onApprove={handleApprove}
          />
        </div>
      )}

      {/* ERROR */}
      {state.phase === "ERROR" && (
        <div
          id="cfo-error"
          style={{
            padding: 16, background: "#1c1917",
            borderRadius: 12, border: "1px solid #7f1d1d",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fca5a5" }}>Hata Oluştu</span>
          </div>
          <div style={{ fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>
            {state.errorMsg}
          </div>
          {state.question && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Soru: &quot;{state.question}&quot;
            </div>
          )}
          <button
            onClick={reset}
            style={{
              alignSelf: "flex-start", marginTop: 4,
              padding: "6px 14px", borderRadius: 6,
              border: "1px solid #475569", background: "transparent",
              color: "#94a3b8", fontSize: 13, cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}
