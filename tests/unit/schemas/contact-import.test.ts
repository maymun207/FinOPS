/**
 * @vitest-environment node
 *
 * Zod schema validation tests for contact import.
 *
 * Tests the contactImportRowSchema with Turkish-locale data,
 * including VKN (tax ID) validation.
 */
import { describe, it, expect } from "vitest";
import {
  contactImportRowSchema,
  validateContactImportBatch,
} from "@/lib/schemas/contact-import.schema";

describe("contactImportRowSchema", () => {
  const validRow = {
    name: "ABC Ticaret A.Ş.",
    type: "müşteri",
    taxId: "1234567890",
    email: "info@abc.com",
    phone: "0212-555-1234",
    address: "İstanbul, Türkiye",
  };

  it("accepts a valid contact row with Turkish type", () => {
    const result = contactImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("ABC Ticaret A.Ş.");
      expect(result.data.type).toBe("customer");
      expect(result.data.taxId).toBe("1234567890");
      expect(result.data.email).toBe("info@abc.com");
    }
  });

  it("transforms 'müşteri' to 'customer'", () => {
    const result = contactImportRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("customer");
    }
  });

  it("transforms 'tedarikçi' to 'vendor'", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      type: "tedarikçi",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("vendor");
    }
  });

  it("transforms 'her ikisi' to 'both'", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      type: "her ikisi",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("both");
    }
  });

  it("rejects invalid type", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      type: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  // ── VKN (Tax ID) validation ───────────────────────────────────
  it("accepts 10-digit VKN", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      taxId: "1234567890",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxId).toBe("1234567890");
    }
  });

  it("accepts 11-digit TC kimlik number", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      taxId: "12345678901",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxId).toBe("12345678901");
    }
  });

  it("row with invalid tax_id (wrong length) fails with message 'VKN must be 10 digits'", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      taxId: "12345", // too short
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const taxIdIssues = result.error.issues.filter(
        (iss) => iss.path.includes("taxId")
      );
      expect(taxIdIssues.length).toBeGreaterThan(0);
      expect(taxIdIssues[0]!.message).toContain("VKN must be 10 digits");
    }
  });

  it("rejects VKN with letters", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      taxId: "123ABC7890",
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing taxId (optional)", () => {
    const { taxId, ...rowWithoutTaxId } = validRow;
    const result = contactImportRowSchema.safeParse(rowWithoutTaxId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxId).toBeUndefined();
    }
  });

  it("treats empty string taxId as undefined", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      taxId: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxId).toBeUndefined();
    }
  });

  // ── Email validation ──────────────────────────────────────────
  it("rejects invalid email", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("treats empty email as undefined", () => {
    const result = contactImportRowSchema.safeParse({
      ...validRow,
      email: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });
});

describe("validateContactImportBatch", () => {
  it("validates a batch with mixed valid/invalid rows", () => {
    const rows = [
      { name: "ABC A.Ş.", type: "müşteri" },
      { name: "", type: "invalid" },
      { name: "XYZ Ltd.", type: "vendor", taxId: "9876543210" },
    ];

    const { valid, errors } = validateContactImportBatch(rows);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.row).toBe(2);
  });
});
