/**
 * cfo-store — Zustand store for Virtual CFO chat session state.
 *
 * Uses Zustand instead of React useReducer so state persists across
 * page navigations within the same session (no remount on route change).
 *
 * States: IDLE → GENERATING → AWAITING_CONFIRMATION → COMPLETE (or ERROR)
 */
import { create } from "zustand";

// ── State types ─────────────────────────────────────────────────────

interface IdleState {
  phase: "IDLE";
}

interface GeneratingState {
  phase: "GENERATING";
  runId: string;
  question: string;
}

interface AwaitingState {
  phase: "AWAITING_CONFIRMATION";
  question: string;
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  latencyMs: number;
}

interface CompleteState {
  phase: "COMPLETE";
  question: string;
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  latencyMs: number;
}

interface ErrorState {
  phase: "ERROR";
  message: string;
  question?: string;
}

export type CFOState =
  | IdleState
  | GeneratingState
  | AwaitingState
  | CompleteState
  | ErrorState;

// ── Store interface ─────────────────────────────────────────────────

interface CFOStore {
  state: CFOState;
  ask: (runId: string, question: string) => void;
  inferenceDone: (data: {
    question: string;
    sql: string;
    explanation: string;
    rows: Record<string, unknown>[];
    rowCount: number;
    latencyMs: number;
  }) => void;
  inferenceRejected: (question: string, reason: string) => void;
  confirm: () => void;
  cancel: () => void;
  error: (message: string, question?: string) => void;
  reset: () => void;
}

export const useCFOStore = create<CFOStore>((set, get) => ({
  state: { phase: "IDLE" } as CFOState,

  ask: (runId, question) =>
    { set({ state: { phase: "GENERATING", runId, question } }); },

  inferenceDone: (data) =>
    { set({
      state: {
        phase: "AWAITING_CONFIRMATION",
        ...data,
      },
    }); },

  inferenceRejected: (question, reason) =>
    { set({
      state: {
        phase: "ERROR",
        message: `SQL güvenlik kontrolünden geçemedi: ${reason}`,
        question,
      },
    }); },

  confirm: () => {
    const current = get().state;
    if (current.phase !== "AWAITING_CONFIRMATION") return;
    set({
      state: {
        phase: "COMPLETE",
        question: current.question,
        sql: current.sql,
        explanation: current.explanation,
        rows: current.rows,
        rowCount: current.rowCount,
        latencyMs: current.latencyMs,
      },
    });
  },

  cancel: () => { set({ state: { phase: "IDLE" } }); },

  error: (message, question) =>
    { set({ state: { phase: "ERROR", message, question } }); },

  reset: () => { set({ state: { phase: "IDLE" } }); },
}));
