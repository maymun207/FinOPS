/**
 * Import Pipeline Tests — validates Zod schemas and promotion function interfaces.
 *
 * Tests:
 *   1. Invoice import schema validates correctly with Turkish locale
 *   2. Contact import schema validates correctly
 *   3. Journal import schema validates correctly
 *   4. Schema rejects invalid data with descriptive errors
 */
import { describe, it, expect } from "vitest";
import { invoiceImportRowSchema } from "@/lib/schemas/invoice-import.schema";
import { contactImportRowSchema } from "@/lib/schemas/contact-import.schema";
import { journalImportRowSchema } from "@/lib/schemas/journal-import.schema";

describe("Invoice Import Schema", () => {
  it("parses valid Turkish-format invoice row", () => {
    const row = {
      invoiceNumber: "FAT-2024-001",
      invoiceDate: "01.01.2024",
      dueDate: "31.01.2024",
      direction: "Giriş",
      contactName: "Acme Tedarik Ltd",
      subtotal: "10000,00",
      kdvRate: "20",
      kdvTotal: "2000,00",
      grandTotal: "12000,00",
      currency: "TRY",
      notes: "Test fatura",
    };

    const result = invoiceImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe("inbound");
      expect(result.data.subtotal).toBe("10000.00");
      expect(result.data.grandTotal).toBe("12000.00");
      expect(result.data.invoiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("parses Çıkış as outbound", () => {
    const row = {
      invoiceNumber: "FAT-2024-002",
      invoiceDate: "15.01.2024",
      direction: "Çıkış",
      contactName: "Beta A.Ş.",
      subtotal: "5000,00",
      kdvTotal: "1000,00",
      grandTotal: "6000,00",
    };

    const result = invoiceImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direction).toBe("outbound");
    }
  });

  it("rejects missing required fields", () => {
    const row = {
      direction: "Giriş",
      // Missing invoiceNumber, invoiceDate, contactName, subtotal, kdvTotal, grandTotal
    };

    const result = invoiceImportRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });
});

describe("Contact Import Schema", () => {
  it("parses valid contact row", () => {
    const row = {
      name: "Acme Ltd",
      type: "Tedarikçi",
      taxId: "1234567890",
      email: "info@acme.com",
      phone: "+90 212 555 0001",
      address: "Kadıköy, İstanbul",
    };

    const result = contactImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("vendor");
      expect(result.data.name).toBe("Acme Ltd");
    }
  });

  it("parses Müşteri as customer", () => {
    const row = { name: "Beta A.Ş.", type: "Müşteri" };
    const result = contactImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("customer");
    }
  });

  it("parses İkisi de as both", () => {
    const row = { name: "Gamma Ltd", type: "İkisi de" };
    const result = contactImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("both");
    }
  });

  it("rejects missing name", () => {
    const row = { type: "Müşteri" };
    const result = contactImportRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("rejects invalid tax ID format", () => {
    const row = { name: "Test", type: "Müşteri", taxId: "123" };
    const result = contactImportRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });
});

describe("Journal Import Schema", () => {
  it("parses valid journal line", () => {
    const row = {
      entryDate: "01.01.2024",
      accountCode: "770",
      debitAmount: "5000,00",
      creditAmount: "0,00",
      description: "Kira gideri Ocak 2024",
    };

    const result = journalImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.debitAmount).toBe("5000.00");
      expect(result.data.creditAmount).toBe("0.00");
      expect(result.data.accountCode).toBe("770");
    }
  });

  it("defaults debit/credit to 0 when not provided", () => {
    const row = {
      entryDate: "15.01.2024",
      accountCode: "120",
      description: "Test kayıt",
    };

    const result = journalImportRowSchema.safeParse(row);
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod default("0") applies after transform — returns the default string
      expect(result.data.debitAmount).toBe("0");
      expect(result.data.creditAmount).toBe("0");
    }
  });

  it("rejects missing description", () => {
    const row = {
      entryDate: "01.01.2024",
      accountCode: "770",
    };

    const result = journalImportRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });
});
