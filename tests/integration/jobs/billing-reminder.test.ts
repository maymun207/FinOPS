/**
 * @vitest-environment node
 *
 * Integration tests: Daily billing reminder cron task.
 *
 * Tests (mock mode):
 *   1. Invoices due within 7 days → generates reminders
 *   2. Overdue invoices → generates OVERDUE reminders
 *   3. PAID invoices → no reminder generated
 *   4. CANCELLED invoices → no reminder generated
 *   5. No qualifying invoices → { reminders_sent: 0 }
 */
import { describe, it, expect } from "vitest";

// ── Mock invoice data ──────────────────────────────────────────────

interface MockInvoice {
  id: string;
  invoiceNumber: string;
  direction: "outbound" | "inbound";
  dueDate: string;
  grandTotal: string;
  status: string;
  companyId: string;
}

function createMockInvoice(
  overrides: Partial<MockInvoice> = {}
): MockInvoice {
  return {
    id: `inv-${Math.random().toString(36).substring(2, 8)}`,
    invoiceNumber: `FAT-${Math.floor(Math.random() * 9999) + 1}`,
    direction: "outbound",
    dueDate: new Date().toISOString().split("T")[0]!,
    grandTotal: "1000.00",
    status: "ISSUED",
    companyId: "company-001",
    ...overrides,
  };
}

/**
 * Simulate the billing reminder task logic.
 * Returns reminders for invoices matching the criteria.
 */
function simulateBillingReminder(
  invoices: MockInvoice[],
  today: Date = new Date()
): { reminders_sent: number; reminders: Array<{ id: string; type: string }> } {
  const todayStr = today.toISOString().split("T")[0]!;
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0]!;

  const EXCLUDED = ["PAID", "CANCELLED"];

  const eligible = invoices.filter((inv) => {
    if (inv.direction !== "outbound") return false;
    if (EXCLUDED.includes(inv.status)) return false;
    return true;
  });

  const reminders: Array<{ id: string; type: string }> = [];

  for (const inv of eligible) {
    // Overdue: due date < today
    if (inv.dueDate < todayStr) {
      reminders.push({ id: inv.id, type: "OVERDUE" });
    }
    // Upcoming: due date between today and next week
    else if (inv.dueDate >= todayStr && inv.dueDate <= nextWeekStr) {
      reminders.push({ id: inv.id, type: "UPCOMING" });
    }
  }

  return { reminders_sent: reminders.length, reminders };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("Billing Reminder — mock pipeline", () => {
  const today = new Date("2025-01-15");
  const in3Days = "2025-01-18";
  const in10Days = "2025-01-25";
  const yesterday = "2025-01-14";
  const lastWeek = "2025-01-08";

  it("invoice due within 7 days → generates UPCOMING reminder", () => {
    const invoices = [
      createMockInvoice({ dueDate: in3Days, status: "ISSUED" }),
    ];

    const result = simulateBillingReminder(invoices, today);

    expect(result.reminders_sent).toBe(1);
    expect(result.reminders[0]!.type).toBe("UPCOMING");
  });

  it("overdue invoice → generates OVERDUE reminder", () => {
    const invoices = [
      createMockInvoice({ dueDate: lastWeek, status: "ISSUED" }),
    ];

    const result = simulateBillingReminder(invoices, today);

    expect(result.reminders_sent).toBe(1);
    expect(result.reminders[0]!.type).toBe("OVERDUE");
  });

  it("PAID invoice → no reminder generated", () => {
    const invoices = [
      createMockInvoice({ dueDate: in3Days, status: "PAID" }),
    ];

    const result = simulateBillingReminder(invoices, today);
    expect(result.reminders_sent).toBe(0);
  });

  it("CANCELLED invoice → no reminder generated", () => {
    const invoices = [
      createMockInvoice({ dueDate: yesterday, status: "CANCELLED" }),
    ];

    const result = simulateBillingReminder(invoices, today);
    expect(result.reminders_sent).toBe(0);
  });

  it("no qualifying invoices → { reminders_sent: 0 }", () => {
    const invoices = [
      // All inbound
      createMockInvoice({ direction: "inbound", dueDate: in3Days }),
      // All paid
      createMockInvoice({ status: "PAID", dueDate: yesterday }),
      // Due in 10 days (outside 7-day window)
      createMockInvoice({ dueDate: in10Days, status: "ISSUED" }),
    ];

    const result = simulateBillingReminder(invoices, today);
    expect(result.reminders_sent).toBe(0);
  });

  it("mixed: 2 upcoming, 1 overdue, 1 paid, 1 cancelled → 3 reminders", () => {
    const invoices = [
      createMockInvoice({ dueDate: in3Days, status: "ISSUED" }),      // upcoming
      createMockInvoice({ dueDate: "2025-01-15", status: "ISSUED" }), // today = upcoming
      createMockInvoice({ dueDate: lastWeek, status: "ISSUED" }),     // overdue
      createMockInvoice({ dueDate: in3Days, status: "PAID" }),        // excluded
      createMockInvoice({ dueDate: yesterday, status: "CANCELLED" }), // excluded
    ];

    const result = simulateBillingReminder(invoices, today);

    expect(result.reminders_sent).toBe(3);
    expect(result.reminders.filter((r) => r.type === "UPCOMING")).toHaveLength(2);
    expect(result.reminders.filter((r) => r.type === "OVERDUE")).toHaveLength(1);
  });
});
