/**
 * ubl-builder.test.ts — Unit tests for UBL 2.1 XML builder.
 *
 * Validates 5 spec-required test cases:
 *   1. Generated XML contains all required namespace declarations
 *   2. Invoice UUID appears in <cbc:UUID> element
 *   3. KDV total matches sum of line item kdv_amounts
 *   4. XML is valid UTF-8 with Turkish characters (ğ, ü, ş, ı, ö, ç) encoded correctly
 *   5. Parse generated XML with xml2js → no parse errors
 */
import { describe, it, expect } from "vitest";
import { buildUBLInvoice, generateInvoiceId, type UBLInvoiceData } from "@/lib/gib/ubl-builder";
import { parseStringPromise } from "xml2js";

// ── Test fixture ────────────────────────────────────────────────────

const SAMPLE_DATA: UBLInvoiceData = {
  uuid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  invoiceId: "TST2024000000001",
  issueDate: "2024-06-15",
  invoiceTypeCode: "SATIS",
  profileId: "TEMELFATURA",
  currency: "TRY",
  supplier: {
    name: "Örnek Şirket A.Ş.",
    taxId: "1234567890",
    address: "Atatürk Cad. No:42",
    city: "İstanbul",
    country: "Türkiye",
  },
  customer: {
    name: "Müşteri Güneş Ltd. Şti.",
    taxId: "9876543210",
    address: "Çiçek Sokak No:7",
    city: "Ankara",
    country: "Türkiye",
  },
  lineItems: [
    {
      id: 1,
      description: "Yazılım Geliştirme Hizmeti",
      quantity: 1,
      unitPrice: 10000,
      lineTotal: 10000,
      kdvRate: 20,
      kdvAmount: 2000,
    },
    {
      id: 2,
      description: "Danışmanlık Ücreti",
      quantity: 5,
      unitPrice: 2000,
      lineTotal: 10000,
      kdvRate: 20,
      kdvAmount: 2000,
    },
    {
      id: 3,
      description: "Özel Proje Çalışması",
      quantity: 2,
      unitPrice: 1500,
      lineTotal: 3000,
      kdvRate: 10,
      kdvAmount: 300,
    },
  ],
  taxTotal: 4300,
  lineExtensionAmount: 23000,
  taxInclusiveAmount: 27300,
};

describe("buildUBLInvoice", () => {
  const xml = buildUBLInvoice(SAMPLE_DATA);

  it("contains all required namespace declarations", () => {
    // UBL 2.1 namespaces for Turkish e-Fatura
    expect(xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2");
    expect(xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2");
    expect(xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2");
    expect(xml).toContain("http://www.w3.org/2001/XMLSchema-instance");
  });

  it("includes invoice UUID in <cbc:UUID> element", () => {
    expect(xml).toContain(`<cbc:UUID>${SAMPLE_DATA.uuid}</cbc:UUID>`);
  });

  it("KDV total matches sum of line item kdv_amounts", () => {
    // Sum of kdv_amounts: 2000 + 2000 + 300 = 4300
    const expectedKdvTotal = SAMPLE_DATA.lineItems.reduce((sum, li) => sum + li.kdvAmount, 0);
    expect(expectedKdvTotal).toBe(4300);

    // The TaxTotal/TaxAmount in the XML should match
    // Find the top-level TaxAmount (first occurrence)
    const taxAmountMatch = xml.match(/<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
    expect(taxAmountMatch).not.toBeNull();
    expect(parseFloat(taxAmountMatch![1]!)).toBe(expectedKdvTotal);
  });

  it("is valid UTF-8 with Turkish characters encoded correctly", () => {
    // Verify Turkish characters appear in the XML
    expect(xml).toContain("Örnek Şirket A.Ş.");
    expect(xml).toContain("Müşteri Güneş Ltd. Şti.");
    expect(xml).toContain("Atatürk Cad. No:42");
    expect(xml).toContain("İstanbul");
    expect(xml).toContain("Türkiye");
    expect(xml).toContain("Çiçek Sokak No:7");
    expect(xml).toContain("Danışmanlık Ücreti");
    expect(xml).toContain("Özel Proje Çalışması");

    // Verify the XML declaration specifies UTF-8
    expect(xml).toContain('encoding="UTF-8"');
  });

  it("parses with xml2js without errors", async () => {
    const result = await parseStringPromise(xml);
    expect(result).toBeDefined();
    expect(result.Invoice).toBeDefined();

    // Verify key elements are present in parsed structure
    const invoice = result.Invoice;
    expect(invoice).toHaveProperty("cbc:UBLVersionID");
    expect(invoice).toHaveProperty("cbc:UUID");
    expect(invoice).toHaveProperty("cbc:IssueDate");
    expect(invoice).toHaveProperty("cac:TaxTotal");
    expect(invoice).toHaveProperty("cac:LegalMonetaryTotal");
    expect(invoice).toHaveProperty("cac:InvoiceLine");

    // Verify line count matches
    const lines = invoice["cac:InvoiceLine"];
    expect(lines).toHaveLength(3);
  });
});

describe("generateInvoiceId", () => {
  it("generates correct format: 3-letter series + 4-digit year + 9-digit seq", () => {
    const id = generateInvoiceId("TST", 2024, 1);
    expect(id).toBe("TST2024000000001");
  });

  it("pads sequence number correctly", () => {
    const id = generateInvoiceId("ABC", 2024, 12345);
    expect(id).toBe("ABC2024000012345");
  });

  it("truncates series to 3 characters", () => {
    const id = generateInvoiceId("TOOLONG", 2024, 1);
    expect(id).toBe("TOO2024000000001");
  });

  it("uses TST as default sandbox series", () => {
    const id = generateInvoiceId();
    expect(id.startsWith("TST")).toBe(true);
  });
});
