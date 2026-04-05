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
  contactName: string | null;
  contactEmail: string | null;
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
    contactName: "Test Contact",
    contactEmail: "test@resend.dev",
    ...overrides,
  };
}

/**
 * Simulate the billing reminder task logic.
 * Handles contacts without email gracefully — logs warning, never throws.
 */
function simulateBillingReminder(
  invoices: MockInvoice[],
  today: Date = new Date()
): {
  reminders_sent: number;
  skipped_no_email: number;
  reminders: Array<{ id: string; type: string }>;
  warnings: string[];
} {
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
  const warnings: string[] = [];
  let skippedNoEmail = 0;

  for (const inv of eligible) {
    let type: string | null = null;

    // Overdue: due date < today
    if (inv.dueDate < todayStr) {
      type = "OVERDUE";
    }
    // Upcoming: due date between today and next week
    else if (inv.dueDate >= todayStr && inv.dueDate <= nextWeekStr) {
      type = "UPCOMING";
    }

    if (!type) continue;

    // Check if contact has email — handle gracefully
    if (!inv.contactEmail) {
      warnings.push(
        `${type} reminder skipped — contact "${inv.contactName ?? "unknown"}" has no email (${inv.invoiceNumber})`
      );
      skippedNoEmail++;
      continue;
    }

    reminders.push({ id: inv.id, type });
  }

  return { reminders_sent: reminders.length, skipped_no_email: skippedNoEmail, reminders, warnings };
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
      createMockInvoice({ direction: "inbound", dueDate: in3Days }),
      createMockInvoice({ status: "PAID", dueDate: yesterday }),
      createMockInvoice({ dueDate: in10Days, status: "ISSUED" }),
    ];

    const result = simulateBillingReminder(invoices, today);
    expect(result.reminders_sent).toBe(0);
  });

  it("mixed: 2 upcoming, 1 overdue, 1 paid, 1 cancelled → 3 reminders", () => {
    const invoices = [
      createMockInvoice({ dueDate: in3Days, status: "ISSUED" }),
      createMockInvoice({ dueDate: "2025-01-15", status: "ISSUED" }),
      createMockInvoice({ dueDate: lastWeek, status: "ISSUED" }),
      createMockInvoice({ dueDate: in3Days, status: "PAID" }),
      createMockInvoice({ dueDate: yesterday, status: "CANCELLED" }),
    ];

    const result = simulateBillingReminder(invoices, today);

    expect(result.reminders_sent).toBe(3);
    expect(result.reminders.filter((r) => r.type === "UPCOMING")).toHaveLength(2);
    expect(result.reminders.filter((r) => r.type === "OVERDUE")).toHaveLength(1);
  });

  it("Seed: 2 overdue, 1 not-yet-due → sends 2 emails, not 3", () => {
    const invoices = [
      createMockInvoice({ dueDate: lastWeek, status: "ISSUED", contactEmail: "a@resend.dev" }),
      createMockInvoice({ dueDate: yesterday, status: "ISSUED", contactEmail: "b@resend.dev" }),
      createMockInvoice({ dueDate: in10Days, status: "ISSUED", contactEmail: "c@resend.dev" }), // >7 days out
    ];

    const result = simulateBillingReminder(invoices, today);

    expect(result.reminders_sent).toBe(2);
    expect(result.reminders.every((r) => r.type === "OVERDUE")).toBe(true);
    // The 3rd invoice is beyond the 7-day window
    expect(result.skipped_no_email).toBe(0);
  });

  it("invoice with contact without email → handles gracefully, logs warning, continues", () => {
    const invoices = [
      createMockInvoice({
        dueDate: in3Days,
        status: "ISSUED",
        contactName: "Emailsiz Firma",
        contactEmail: null, // no email
      }),
      createMockInvoice({
        dueDate: in3Days,
        status: "ISSUED",
        contactEmail: "valid@resend.dev",
      }),
      createMockInvoice({
        dueDate: lastWeek,
        status: "ISSUED",
        contactName: "Diğer Firma",
        contactEmail: null, // no email
      }),
    ];

    const result = simulateBillingReminder(invoices, today);

    // Only 1 reminder sent (the one with email)
    expect(result.reminders_sent).toBe(1);

    // 2 skipped due to no email
    expect(result.skipped_no_email).toBe(2);

    // Warnings logged for each skipped
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("Emailsiz Firma");
    expect(result.warnings[0]).toContain("has no email");
    expect(result.warnings[1]).toContain("Diğer Firma");
    expect(result.warnings[1]).toContain("OVERDUE");
  });
});
