/**
 * @vitest-environment node
 *
 * Zod schema validation tests for invoice import.
 *
 * Tests the invoiceImportRowSchema with Turkish-locale data,
 * including number/date parsing integration.
 */
import { describe, it, expect } from "vitest";
import {
  invoiceImportRowSchema,
  validateInvoiceImportBatch,
  type InvoiceImportRow,
} from "@/lib/schemas/invoice-import.schema";

describe("invoiceImportRowSchema", () => {
  const validRow = {
    invoiceNumber: "FAT-001",
    invoiceDate: "01.03.2024",
    direction: "satış",
    contactName: "ABC Ticaret A.Ş.",
    subtotal: "1.000,00",
    kdvTotal: "200,00",
    grandTotal: "1.200,00",
  };

  it("accepts a valid Turkish-format invoice row", () => {
    const result = invoiceImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.invoiceNumber).toBe("FAT-001");
      expect(result.data.invoiceDate).toBe("2024-03-01");
      expect(result.data.direction).toBe("outbound");
      expect(result.data.contactName).toBe("ABC Ticaret A.Ş.");
      expect(result.data.subtotal).toBe("1000.00");
      expect(result.data.kdvTotal).toBe("200.00");
      expect(result.data.grandTotal).toBe("1200.00");
      expect(result.data.currency).toBe("TRY");
    }
  });

  it("transforms 'satış' to 'outbound'", () => {
    const result = invoiceImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe("outbound");
    }
  });

  it("transforms 'alış' to 'inbound'", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      direction: "alış",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe("inbound");
    }
  });

  it("accepts Excel serial date", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      invoiceDate: 45352,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoiceDate).toBe("2024-03-01");
    }
  });

  it("accepts English-format numbers", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      subtotal: "1,000.00",
      kdvTotal: "200.00",
      grandTotal: "1,200.00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtotal).toBe("1000.00");
    }
  });

  it("rejects missing invoice number", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      invoiceNumber: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid direction", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      direction: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      invoiceDate: "Jan 2024",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid number", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      subtotal: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("defaults currency to TRY", () => {
    const result = invoiceImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("TRY");
    }
  });

  it("accepts optional dueDate", () => {
    const result = invoiceImportRowSchema.safeParse({
      ...validRow,
      dueDate: "15.04.2024",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBe("2024-04-15");
    }
  });
});

describe("validateInvoiceImportBatch", () => {
  it("validates a batch of mixed valid/invalid rows", () => {
    const rows = [
      {
        invoiceNumber: "FAT-001",
        invoiceDate: "01.03.2024",
        direction: "satış",
        contactName: "ABC A.Ş.",
        subtotal: "1.000,00",
        kdvTotal: "200,00",
        grandTotal: "1.200,00",
      },
      {
        invoiceNumber: "",
        invoiceDate: "invalid",
        direction: "unknown",
        contactName: "",
        subtotal: "abc",
        kdvTotal: "200,00",
        grandTotal: "1.200,00",
      },
      {
        invoiceNumber: "FAT-002",
        invoiceDate: 45352,
        direction: "alış",
        contactName: "XYZ Ltd.",
        subtotal: "500,00",
        kdvTotal: "100,00",
        grandTotal: "600,00",
      },
    ];

    const { valid, errors } = validateInvoiceImportBatch(rows);

    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.row).toBe(2);
    expect(errors[0]!.issues.length).toBeGreaterThan(0);
  });

  it("returns all valid when batch is clean", () => {
    const rows = [
      {
        invoiceNumber: "FAT-001",
        invoiceDate: "01.03.2024",
        direction: "satış",
        contactName: "ABC A.Ş.",
        subtotal: "1.000,00",
        kdvTotal: "200,00",
        grandTotal: "1.200,00",
      },
    ];

    const { valid, errors } = validateInvoiceImportBatch(rows);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});
