/**
 * query-flow.spec.ts — Integration tests for CFO chat state machine.
 *
 * Tests the Zustand store logic directly (no browser needed) to verify
 * the state machine handles all transitions correctly.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useCFOStore } from "@/lib/cfo/cfo-store";

describe("CFO Chat State Machine (Zustand)", () => {
  const SAMPLE_SQL = `SELECT SUM(ili.kdv_rate * ili.line_total / 100) AS "Toplam KDV" FROM invoice_line_items ili`;
  const SAMPLE_ROWS: Record<string, unknown>[] = [{ "Toplam KDV": 23456.78 }];
  const SAMPLE_EXPLANATION = "Bu sorgu, fatura kalem satırlarından toplam KDV tutarını hesaplar.";

  beforeEach(() => {
    useCFOStore.setState({ state: { phase: "IDLE" } });
  });

  it("starts in IDLE phase", () => {
    expect(useCFOStore.getState().state.phase).toBe("IDLE");
  });

  it("IDLE → ask → GENERATING", () => {
    useCFOStore.getState().ask("run_abc", "Bu dönemde toplam KDV?");
    const state = useCFOStore.getState().state;
    expect(state.phase).toBe("GENERATING");
    if (state.phase === "GENERATING") {
      expect(state.runId).toBe("run_abc");
      expect(state.question).toBe("Bu dönemde toplam KDV?");
    }
  });

  it("GENERATING → inferenceDone → AWAITING_CONFIRMATION", () => {
    useCFOStore.getState().ask("run_abc", "Toplam KDV?");
    useCFOStore.getState().inferenceDone({
      question: "Toplam KDV?",
      sql: SAMPLE_SQL,
      explanation: SAMPLE_EXPLANATION,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 1500,
    });
    const state = useCFOStore.getState().state;
    expect(state.phase).toBe("AWAITING_CONFIRMATION");
    if (state.phase === "AWAITING_CONFIRMATION") {
      expect(state.sql).toBe(SAMPLE_SQL);
      expect(state.explanation).toBe(SAMPLE_EXPLANATION);
      expect(state.rows).toEqual(SAMPLE_ROWS);
      expect(state.rowCount).toBe(1);
    }
  });

  it("AWAITING_CONFIRMATION → confirm → COMPLETE", () => {
    // Set up AWAITING state
    useCFOStore.setState({
      state: {
        phase: "AWAITING_CONFIRMATION",
        question: "Toplam KDV?",
        sql: SAMPLE_SQL,
        explanation: SAMPLE_EXPLANATION,
        rows: SAMPLE_ROWS,
        rowCount: 1,
        latencyMs: 1500,
      },
    });
    useCFOStore.getState().confirm();
    const state = useCFOStore.getState().state;
    expect(state.phase).toBe("COMPLETE");
    if (state.phase === "COMPLETE") {
      expect(state.rows).toEqual(SAMPLE_ROWS);
    }
  });

  it("AWAITING_CONFIRMATION → cancel → IDLE", () => {
    useCFOStore.setState({
      state: {
        phase: "AWAITING_CONFIRMATION",
        question: "Toplam KDV?",
        sql: SAMPLE_SQL,
        explanation: SAMPLE_EXPLANATION,
        rows: SAMPLE_ROWS,
        rowCount: 1,
        latencyMs: 1500,
      },
    });
    useCFOStore.getState().cancel();
    expect(useCFOStore.getState().state.phase).toBe("IDLE");
  });

  it("GENERATING → inferenceRejected → ERROR", () => {
    useCFOStore.getState().ask("run_xyz", "Drop table?");
    useCFOStore.getState().inferenceRejected("Drop table?", "Only SELECT queries allowed");
    const state = useCFOStore.getState().state;
    expect(state.phase).toBe("ERROR");
    if (state.phase === "ERROR") {
      expect(state.message).toContain("güvenlik");
      expect(state.question).toBe("Drop table?");
    }
  });

  it("ERROR → reset → IDLE", () => {
    useCFOStore.getState().error("Connection failed", "Test?");
    useCFOStore.getState().reset();
    expect(useCFOStore.getState().state.phase).toBe("IDLE");
  });

  it("COMPLETE → reset → IDLE (new question)", () => {
    useCFOStore.setState({
      state: {
        phase: "COMPLETE",
        question: "Toplam?",
        sql: SAMPLE_SQL,
        explanation: SAMPLE_EXPLANATION,
        rows: SAMPLE_ROWS,
        rowCount: 1,
        latencyMs: 1000,
      },
    });
    useCFOStore.getState().reset();
    expect(useCFOStore.getState().state.phase).toBe("IDLE");
  });

  it("confirm from non-AWAITING state is a no-op", () => {
    // From IDLE
    useCFOStore.getState().confirm();
    expect(useCFOStore.getState().state.phase).toBe("IDLE");

    // From GENERATING
    useCFOStore.getState().ask("x", "y");
    useCFOStore.getState().confirm();
    expect(useCFOStore.getState().state.phase).toBe("GENERATING");
  });

  it("full happy path: IDLE → GENERATING → AWAITING → COMPLETE → IDLE", () => {
    const store = useCFOStore.getState();

    store.ask("run_1", "KDV?");
    expect(useCFOStore.getState().state.phase).toBe("GENERATING");

    useCFOStore.getState().inferenceDone({
      question: "KDV?",
      sql: SAMPLE_SQL,
      explanation: SAMPLE_EXPLANATION,
      rows: SAMPLE_ROWS,
      rowCount: 1,
      latencyMs: 800,
    });
    expect(useCFOStore.getState().state.phase).toBe("AWAITING_CONFIRMATION");

    useCFOStore.getState().confirm();
    expect(useCFOStore.getState().state.phase).toBe("COMPLETE");

    useCFOStore.getState().reset();
    expect(useCFOStore.getState().state.phase).toBe("IDLE");
  });
});
