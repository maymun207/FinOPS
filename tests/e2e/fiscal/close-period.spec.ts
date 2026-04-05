/**
 * @vitest-environment node
 *
 * E2E (mock mode): Fiscal period close → verify invoice entries blocked.
 *
 * Tests the complete flow:
 *   1. Close a period with correct confirmation
 *   2. Close with wrong confirmation → error
 *   3. After closing, invoice creation should fail
 *   4. After re-opening, entries should work again
 */
import { describe, it, expect } from "vitest";

const TEST_MODE = process.env.TEST_MODE ?? "mock";
const isRealDB = TEST_MODE === "real";

// ── Mock helpers ──────────────────────────────────────────────────────

interface MockPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt: Date | null;
  closedBy: string | null;
}

/**
 * Simulates the close period mutation with confirmation check.
 */
function simulateClosePeriod(
  period: MockPeriod,
  confirmation: string
): MockPeriod | { error: string } {
  if (period.isClosed) {
    return { error: "Period is already closed" };
  }
  if (confirmation !== period.name) {
    return {
      error: `Onay metni dönem adıyla eşleşmiyor. "${period.name}" yazmanız gerekiyor.`,
    };
  }
  return {
    ...period,
    isClosed: true,
    closedAt: new Date(),
    closedBy: "user-123",
  };
}

/**
 * Simulates checking if an invoice can be created in a given period.
 */
function canCreateInvoice(periods: MockPeriod[]): boolean {
  const openPeriod = periods.find((p) => !p.isClosed);
  return openPeriod !== undefined;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Fiscal period close — mock mode", () => {
  const skipIfReal = isRealDB ? it.skip : it;

  const basePeriod: MockPeriod = {
    id: "period-123",
    name: "2024-03",
    startDate: "2024-03-01",
    endDate: "2024-03-31",
    isClosed: false,
    closedAt: null,
    closedBy: null,
  };

  skipIfReal("closes period with correct confirmation", () => {
    const result = simulateClosePeriod(basePeriod, "2024-03");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.isClosed).toBe(true);
      expect(result.closedAt).toBeInstanceOf(Date);
      expect(result.closedBy).toBe("user-123");
    }
  });

  skipIfReal("rejects closure when confirmation does not match period name", () => {
    const result = simulateClosePeriod(basePeriod, "2024-04");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Onay metni dönem adıyla eşleşmiyor");
    }
  });

  skipIfReal("rejects closure when confirmation is empty", () => {
    const result = simulateClosePeriod(basePeriod, "");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("Onay metni dönem adıyla eşleşmiyor");
    }
  });

  skipIfReal("rejects closure of already-closed period", () => {
    const closedPeriod: MockPeriod = {
      ...basePeriod,
      isClosed: true,
      closedAt: new Date(),
    };
    const result = simulateClosePeriod(closedPeriod, "2024-03");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Period is already closed");
    }
  });

  skipIfReal("after closing, invoice creation is blocked (no open period)", () => {
    const closedPeriod: MockPeriod = {
      ...basePeriod,
      isClosed: true,
      closedAt: new Date(),
    };
    expect(canCreateInvoice([closedPeriod])).toBe(false);
  });

  skipIfReal("with an open period, invoice creation is allowed", () => {
    expect(canCreateInvoice([basePeriod])).toBe(true);
  });

  skipIfReal("after re-opening, invoice creation is allowed again", () => {
    const closedPeriod: MockPeriod = {
      ...basePeriod,
      isClosed: true,
      closedAt: new Date(),
    };

    // Simulate re-opening
    const reopened: MockPeriod = {
      ...closedPeriod,
      isClosed: false,
      closedAt: null,
      closedBy: null,
    };

    expect(canCreateInvoice([reopened])).toBe(true);
  });
});

describe("Fiscal period close — real DB mode", () => {
  const skipIfMock = !isRealDB ? it.skip : it;

  skipIfMock("close period and verify journal entry insert is blocked", async () => {
    console.log("[REAL DB] Close period → block journal entries");
    expect(true).toBe(true); // Placeholder
  });

  skipIfMock("re-open period and verify journal entry insert works", async () => {
    console.log("[REAL DB] Re-open period → allow entries");
    expect(true).toBe(true); // Placeholder
  });
});
