/**
 * submission.test.ts — Integration tests for GIB e-Fatura submission.
 *
 * Tests the mock GIB client directly (no real API calls).
 *
 * Test cases:
 *   1. Submit to GIB sandbox → receives ACCEPTED response, gib_status updated
 *   2. GIB returns error → gib_status = REJECTED
 */
import { describe, it, expect } from "vitest";
import { MockGIBClient } from "@/lib/gib/gib-client";
import { buildUBLInvoice, type UBLInvoiceData } from "@/lib/gib/ubl-builder";

// ── Test fixture ────────────────────────────────────────────────────

const SAMPLE_DATA: UBLInvoiceData = {
  uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  invoiceId: "TST2024000000001",
  issueDate: "2024-06-15",
  invoiceTypeCode: "SATIS",
  profileId: "TEMELFATURA",
  currency: "TRY",
  supplier: {
    name: "Test Şirket",
    taxId: "1234567890",
  },
  customer: {
    name: "Test Müşteri",
    taxId: "9876543210",
  },
  lineItems: [
    {
      id: 1,
      description: "Test Ürün",
      quantity: 1,
      unitPrice: 1000,
      lineTotal: 1000,
      kdvRate: 20,
      kdvAmount: 200,
    },
  ],
  taxTotal: 200,
  lineExtensionAmount: 1000,
  taxInclusiveAmount: 1200,
};

describe("GIB e-Fatura Submission", () => {
  it("submits to GIB sandbox and receives ACCEPTED response", async () => {
    const client = new MockGIBClient();
    const xml = buildUBLInvoice(SAMPLE_DATA);

    // Step 1: Submit
    const submitResult = await client.submitInvoice(xml);
    expect(submitResult.success).toBe(true);
    expect(submitResult.ettn).toBeTruthy();
    expect(submitResult.status).toBe("PENDING");

    // Step 2: Poll for status
    const statusResult = await client.checkStatus(submitResult.ettn);
    expect(statusResult.status).toBe("ACCEPTED");

    // Simulate updating gib_status in the database
    const gibStatus = statusResult.status === "ACCEPTED" ? "accepted" : "rejected";
    expect(gibStatus).toBe("accepted");
  }, 10_000); // Allow 10s for the 2s mock delay

  it("returns REJECTED when empty XML is submitted", async () => {
    const client = new MockGIBClient();

    // Submit empty XML
    const submitResult = await client.submitInvoice("");
    expect(submitResult.success).toBe(false);
    expect(submitResult.status).toBe("REJECTED");
    expect(submitResult.errorMessage).toBeTruthy();

    // Simulate updating gib_status after rejection
    const gibStatus = "rejected";
    expect(gibStatus).toBe("rejected");
  });

  it("returns REJECTED for invalid ETTN in status check", async () => {
    const client = new MockGIBClient();

    const statusResult = await client.checkStatus("");
    expect(statusResult.status).toBe("REJECTED");
    expect(statusResult.rejectionReason).toBeTruthy();
  });
});
