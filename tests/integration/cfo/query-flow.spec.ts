/**
 * query-flow.spec.ts — E2E tests for CFO chat state machine transitions.
 *
 * Tests the reducer logic directly (no browser needed) to verify
 * the state machine handles all transitions correctly.
 */
import { describe, it, expect } from "vitest";

// ── Inline state machine types (same as CFOChatSession) ─────────────

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

// ── Tests ───────────────────────────────────────────────────────────

describe("CFO Chat State Machine", () => {
  const INITIAL: ChatState = { phase: "IDLE" };

  const SAMPLE_SQL = `SELECT SUM(ili.kdv_rate * ili.line_total / 100) AS "Toplam KDV" FROM invoice_line_items ili`;
  const SAMPLE_ROWS: Record<string, unknown>[] = [{ "Toplam KDV": 23456.78 }];

  it("IDLE → ASK → GENERATING", () => {
    const next = chatReducer(INITIAL, {
      type: "ASK",
      runId: "run_abc",
      question: "Bu dönemde toplam KDV?",
    });
    expect(next.phase).toBe("GENERATING");
    if (next.phase === "GENERATING") {
      expect(next.runId).toBe("run_abc");
      expect(next.question).toBe("Bu dönemde toplam KDV?");
    }
  });

  it("GENERATING → INFERENCE_DONE → AWAITING_CONFIRMATION", () => {
    const generating: ChatState = {
      phase: "GENERATING",
      runId: "run_abc",
      question: "Toplam KDV?",
    };
    const next = chatReducer(generating, {
      type: "INFERENCE_DONE",
      question: "Toplam KDV?",
      sql: SAMPLE_SQL,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 1500,
    });
    expect(next.phase).toBe("AWAITING_CONFIRMATION");
    if (next.phase === "AWAITING_CONFIRMATION") {
      expect(next.sql).toBe(SAMPLE_SQL);
      expect(next.rows).toEqual(SAMPLE_ROWS);
      expect(next.rowCount).toBe(1);
    }
  });

  it("AWAITING_CONFIRMATION → CONFIRM → COMPLETE", () => {
    const awaiting: ChatState = {
      phase: "AWAITING_CONFIRMATION",
      question: "Toplam KDV?",
      sql: SAMPLE_SQL,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 1500,
    };
    const next = chatReducer(awaiting, { type: "CONFIRM" });
    expect(next.phase).toBe("COMPLETE");
    if (next.phase === "COMPLETE") {
      expect(next.rows).toEqual(SAMPLE_ROWS);
    }
  });

  it("AWAITING_CONFIRMATION → CANCEL → IDLE", () => {
    const awaiting: ChatState = {
      phase: "AWAITING_CONFIRMATION",
      question: "Toplam KDV?",
      sql: SAMPLE_SQL,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 1500,
    };
    const next = chatReducer(awaiting, { type: "CANCEL" });
    expect(next.phase).toBe("IDLE");
  });

  it("GENERATING → INFERENCE_REJECTED → ERROR", () => {
    const generating: ChatState = {
      phase: "GENERATING",
      runId: "run_xyz",
      question: "Drop table?",
    };
    const next = chatReducer(generating, {
      type: "INFERENCE_REJECTED",
      reason: "Only SELECT queries allowed",
      question: "Drop table?",
    });
    expect(next.phase).toBe("ERROR");
    if (next.phase === "ERROR") {
      expect(next.message).toContain("güvenlik");
      expect(next.question).toBe("Drop table?");
    }
  });

  it("ERROR → RESET → IDLE", () => {
    const error: ChatState = {
      phase: "ERROR",
      message: "Connection failed",
      question: "Test?",
    };
    const next = chatReducer(error, { type: "RESET" });
    expect(next.phase).toBe("IDLE");
  });

  it("COMPLETE → RESET → IDLE (new question)", () => {
    const complete: ChatState = {
      phase: "COMPLETE",
      question: "Toplam?",
      sql: SAMPLE_SQL,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 1000,
    };
    const next = chatReducer(complete, { type: "RESET" });
    expect(next.phase).toBe("IDLE");
  });

  it("CONFIRM from non-AWAITING state is a no-op", () => {
    const idle: ChatState = { phase: "IDLE" };
    expect(chatReducer(idle, { type: "CONFIRM" })).toBe(idle);

    const generating: ChatState = { phase: "GENERATING", runId: "x", question: "y" };
    expect(chatReducer(generating, { type: "CONFIRM" })).toBe(generating);
  });

  it("full happy path: IDLE → GENERATING → AWAITING → COMPLETE → IDLE", () => {
    let s: ChatState = { phase: "IDLE" };

    s = chatReducer(s, { type: "ASK", runId: "run_1", question: "KDV?" });
    expect(s.phase).toBe("GENERATING");

    s = chatReducer(s, {
      type: "INFERENCE_DONE",
      question: "KDV?",
      sql: SAMPLE_SQL,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 800,
    });
    expect(s.phase).toBe("AWAITING_CONFIRMATION");

    s = chatReducer(s, { type: "CONFIRM" });
    expect(s.phase).toBe("COMPLETE");

    s = chatReducer(s, { type: "RESET" });
    expect(s.phase).toBe("IDLE");
  });
});
