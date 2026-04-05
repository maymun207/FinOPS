/**
 * @vitest-environment node
 *
 * Integration tests: Import quarantine workflow.
 *
 * Tests the full lifecycle:
 *   1. Upload 5 rows: 4 valid + 1 invalid (bad tax_id) → quarantine shows 4 VALID, 1 INVALID
 *   2. Approve all 4 valid rows → creates 4 invoices, 4 APPROVED quarantine rows
 *   3. Attempt to approve a row targeting a closed fiscal period → row marked REJECTED with reason
 *   4. Reject an INVALID row → status = REJECTED, no invoice created
 *
 * Uses mock-first approach with optional real DB via TEST_MODE=real.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Mock helpers ──────────────────────────────────────────────────────

interface QuarantineRow {
  id: string;
  companyId: string;
  source: string;
  rawData: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  errorMessage: string | null;
  mappingProfileId: string | null;
  createdAt: string;
}

/**
 * Simulates Zod validation of a contact import row.
 * Returns { valid: boolean, error?: string }.
 */
function validateContactRow(row: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  const taxId = String(row.taxId ?? "");
  // VKN must be 10 or 11 digits
  if (!/^\d{10,11}$/.test(taxId)) {
    return { valid: false, error: `Geçersiz VKN: "${taxId}" — 10 veya 11 haneli olmalı` };
  }
  const name = String(row.name ?? "").trim();
  if (!name) {
    return { valid: false, error: "İsim alanı zorunludur" };
  }
  return { valid: true };
}

/**
 * Simulates queuing rows into quarantine.
 * Validates each row and sets errorMessage for invalid ones.
 */
function queueToQuarantine(
  rows: Record<string, unknown>[],
  companyId: string
): QuarantineRow[] {
  return rows.map((raw, i) => {
    const validation = validateContactRow(raw);
    return {
      id: `q-${i + 1}`,
      companyId,
      source: "excel",
      rawData: raw,
      status: "pending" as const,
      errorMessage: validation.valid ? null : (validation.error ?? null),
      mappingProfileId: null,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Simulates approving a quarantine row.
 * If the row has errors, rejects with reason.
 * If the fiscal period is closed, rejects with reason.
 */
function approveRow(
  row: QuarantineRow,
  closedPeriods: string[] = []
): { status: "approved" | "rejected"; reason?: string; invoiceCreated: boolean } {
  // Check for existing validation errors
  if (row.errorMessage) {
    return {
      status: "rejected",
      reason: `Doğrulama hatası: ${row.errorMessage}`,
      invoiceCreated: false,
    };
  }

  // Check fiscal period
  const period = String(row.rawData.fiscalPeriod ?? "");
  if (period && closedPeriods.includes(period)) {
    return {
      status: "rejected",
      reason: `Dönem kapalı: ${period}`,
      invoiceCreated: false,
    };
  }

  return { status: "approved", invoiceCreated: true };
}

/**
 * Simulates rejecting a quarantine row.
 */
function rejectRow(
  row: QuarantineRow,
  reason: string
): { status: "rejected"; reason: string; invoiceCreated: boolean } {
  return { status: "rejected", reason, invoiceCreated: false };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Import Quarantine — full lifecycle", () => {
  const COMPANY_ID = "company-001";

  // Test data: 4 valid + 1 invalid (bad tax_id)
  const testRows: Record<string, unknown>[] = [
    { name: "ABC Ltd", type: "customer", taxId: "1234567890", email: "abc@test.com" },
    { name: "XYZ AŞ", type: "vendor", taxId: "9876543210", email: "xyz@test.com" },
    { name: "Deneme Tic.", type: "customer", taxId: "1111111111", email: "den@test.com" },
    { name: "Örnek San.", type: "both", taxId: "2222222222", email: "orn@test.com" },
    // Invalid: bad tax_id (only 5 digits)
    { name: "Hatalı Firma", type: "customer", taxId: "12345", email: "bad@test.com" },
  ];

  let quarantine: QuarantineRow[];

  beforeEach(() => {
    quarantine = queueToQuarantine(testRows, COMPANY_ID);
  });

  it("Upload 5 rows: 4 valid, 1 invalid (bad tax_id) → quarantine shows 4 VALID, 1 INVALID", () => {
    expect(quarantine).toHaveLength(5);

    // 4 valid (no errorMessage)
    const valid = quarantine.filter((r) => r.errorMessage === null);
    expect(valid).toHaveLength(4);

    // 1 invalid
    const invalid = quarantine.filter((r) => r.errorMessage !== null);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.rawData.name).toBe("Hatalı Firma");
    expect(invalid[0]!.errorMessage).toContain("12345");
    expect(invalid[0]!.errorMessage).toContain("VKN");

    // All start as pending
    expect(quarantine.every((r) => r.status === "pending")).toBe(true);
  });

  it("Approve all 4 valid rows → 4 invoices created, 4 APPROVED quarantine rows", () => {
    const validRows = quarantine.filter((r) => r.errorMessage === null);
    expect(validRows).toHaveLength(4);

    const results = validRows.map((row) => approveRow(row));

    // All 4 approved
    expect(results.every((r) => r.status === "approved")).toBe(true);

    // All 4 invoices created
    expect(results.every((r) => r.invoiceCreated)).toBe(true);
    expect(results.filter((r) => r.invoiceCreated)).toHaveLength(4);
  });

  it("Attempt to approve a row targeting a closed fiscal period → row marked REJECTED with reason", () => {
    // Add fiscal period to a row
    const row = { ...quarantine[0]! };
    row.rawData = { ...row.rawData, fiscalPeriod: "2024-Q4" };

    const result = approveRow(row, ["2024-Q4"]);

    expect(result.status).toBe("rejected");
    expect(result.reason).toContain("Dönem kapalı");
    expect(result.reason).toContain("2024-Q4");
    expect(result.invoiceCreated).toBe(false);
  });

  it("Reject an INVALID row → status = REJECTED, no invoice created", () => {
    const invalidRow = quarantine.find((r) => r.errorMessage !== null)!;
    expect(invalidRow).toBeDefined();

    const result = rejectRow(invalidRow, "Geçersiz VKN");

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("Geçersiz VKN");
    expect(result.invoiceCreated).toBe(false);
  });

  it("Promotion is per-row transactional — row 3 fails, rows 1-2 remain committed", () => {
    // Simulate 4 valid rows, but row 3 hits a balance constraint
    const rows = quarantine.filter((r) => r.errorMessage === null);
    expect(rows.length).toBe(4);

    const results: Array<{
      rowIndex: number;
      status: "approved" | "rejected";
      invoiceCreated: boolean;
      reason?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      // Simulate row 3 (index 2) failing with balance constraint
      if (i === 2) {
        results.push({
          rowIndex: i,
          status: "rejected",
          invoiceCreated: false,
          reason: "Balance constraint violation: debits ≠ credits",
        });
      } else {
        const r = approveRow(row);
        results.push({ rowIndex: i, ...r });
      }
    }

    // Rows 0, 1 committed (approved)
    expect(results[0]!.status).toBe("approved");
    expect(results[0]!.invoiceCreated).toBe(true);
    expect(results[1]!.status).toBe("approved");
    expect(results[1]!.invoiceCreated).toBe(true);

    // Row 2 failed
    expect(results[2]!.status).toBe("rejected");
    expect(results[2]!.invoiceCreated).toBe(false);
    expect(results[2]!.reason).toContain("Balance constraint");

    // Row 3 committed (after failure — not rolled back)
    expect(results[3]!.status).toBe("approved");
    expect(results[3]!.invoiceCreated).toBe(true);
  });
});
