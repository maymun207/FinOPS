/**
 * ubl-builder — UBL 2.1 XML envelope builder for Turkish e-Fatura (GİB).
 *
 * Generates a valid UBL 2.1 Invoice XML conforming to GİB TEMEL profile.
 * Uses xmlbuilder2 for structured XML creation.
 *
 * Key specs:
 *   - Namespaces: cac, cbc, xsi for UBL 2.1
 *   - ProfileID: TEMELFATURA or TICARIFATURA
 *   - Invoice ID format: 3-letter series + 4-digit year + 9-digit sequence
 *     e.g. TST2024000000001
 *   - Amounts use period as decimal separator (international format)
 *   - UTF-8 encoding with full Turkish character support (ğ, ü, ş, ı, ö, ç)
 */
import { create } from "xmlbuilder2";

// ── Types ───────────────────────────────────────────────────────────

export interface UBLInvoiceData {
  /** Invoice UUID (from invoices.gib_uuid) */
  uuid: string;
  /** Invoice number in GIB format: series + year + seq (e.g., TST2024000000001) */
  invoiceId: string;
  /** Issue date as YYYY-MM-DD */
  issueDate: string;
  /** Invoice type: SATIS or IADE */
  invoiceTypeCode: "SATIS" | "IADE";
  /** GIB profile: TEMELFATURA or TICARIFATURA */
  profileId: "TEMELFATURA" | "TICARIFATURA";
  /** ISO 4217 currency code */
  currency: string;

  // ── Supplier (seller) ──
  supplier: {
    name: string;
    taxId: string;
    address?: string;
    city?: string;
    country?: string;
  };

  // ── Customer (buyer) ──
  customer: {
    name: string;
    taxId?: string;
    address?: string;
    city?: string;
    country?: string;
  };

  // ── Line items ──
  lineItems: UBLLineItem[];

  // ── Totals ──
  /** Total KDV amount */
  taxTotal: number;
  /** Subtotal before KDV */
  lineExtensionAmount: number;
  /** Grand total including KDV */
  taxInclusiveAmount: number;
}

export interface UBLLineItem {
  /** 1-based line ID */
  id: number;
  /** Item description */
  description: string;
  /** Quantity */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Line subtotal (quantity × unitPrice) */
  lineTotal: number;
  /** KDV rate as percentage (e.g., 20.00) */
  kdvRate: number;
  /** KDV amount for this line */
  kdvAmount: number;
}

// ── UBL 2.1 Namespace constants ─────────────────────────────────────

const NS = {
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Format a number with period decimal separator (international format).
 * GIB requires this even though Turkish locale uses comma.
 */
function formatAmount(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

// ── Main builder ────────────────────────────────────────────────────

/**
 * Build a UBL 2.1 Invoice XML string from structured invoice data.
 *
 * @returns UTF-8 encoded XML string with XML declaration
 */
export function buildUBLInvoice(data: UBLInvoiceData): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele(NS.invoice, "Invoice")
    .att("xmlns:cac", NS.cac)
    .att("xmlns:cbc", NS.cbc)
    .att("xmlns:xsi", NS.xsi);

  // ── Header elements ──
  doc.ele(NS.cbc, "UBLVersionID").txt("2.1").up();
  doc.ele(NS.cbc, "CustomizationID").txt("TR1.2").up();
  doc.ele(NS.cbc, "ProfileID").txt(data.profileId).up();
  doc.ele(NS.cbc, "ID").txt(data.invoiceId).up();
  doc.ele(NS.cbc, "CopyIndicator").txt("false").up();
  doc.ele(NS.cbc, "UUID").txt(data.uuid).up();
  doc.ele(NS.cbc, "IssueDate").txt(data.issueDate).up();
  doc.ele(NS.cbc, "InvoiceTypeCode").txt(data.invoiceTypeCode).up();
  doc.ele(NS.cbc, "DocumentCurrencyCode").txt(data.currency).up();

  // ── Supplier (AccountingSupplierParty) ──
  const supplierParty = doc.ele(NS.cac, "AccountingSupplierParty").ele(NS.cac, "Party");
  const supplierIdent = supplierParty.ele(NS.cac, "PartyIdentification");
  supplierIdent.ele(NS.cbc, "ID").att("schemeID", "VKN").txt(data.supplier.taxId).up();
  supplierIdent.up();

  const supplierName = supplierParty.ele(NS.cac, "PartyName");
  supplierName.ele(NS.cbc, "Name").txt(data.supplier.name).up();
  supplierName.up();

  if (data.supplier.address || data.supplier.city || data.supplier.country) {
    const addr = supplierParty.ele(NS.cac, "PostalAddress");
    if (data.supplier.address) addr.ele(NS.cbc, "StreetName").txt(data.supplier.address).up();
    if (data.supplier.city) addr.ele(NS.cbc, "CityName").txt(data.supplier.city).up();
    const country = addr.ele(NS.cac, "Country");
    country.ele(NS.cbc, "Name").txt(data.supplier.country ?? "Türkiye").up();
    country.up();
    addr.up();
  }
  supplierParty.up().up(); // close Party, AccountingSupplierParty

  // ── Customer (AccountingCustomerParty) ──
  const customerParty = doc.ele(NS.cac, "AccountingCustomerParty").ele(NS.cac, "Party");
  if (data.customer.taxId) {
    const custIdent = customerParty.ele(NS.cac, "PartyIdentification");
    custIdent.ele(NS.cbc, "ID").att("schemeID", "VKN").txt(data.customer.taxId).up();
    custIdent.up();
  }

  const custName = customerParty.ele(NS.cac, "PartyName");
  custName.ele(NS.cbc, "Name").txt(data.customer.name).up();
  custName.up();

  if (data.customer.address || data.customer.city || data.customer.country) {
    const addr = customerParty.ele(NS.cac, "PostalAddress");
    if (data.customer.address) addr.ele(NS.cbc, "StreetName").txt(data.customer.address).up();
    if (data.customer.city) addr.ele(NS.cbc, "CityName").txt(data.customer.city).up();
    const country = addr.ele(NS.cac, "Country");
    country.ele(NS.cbc, "Name").txt(data.customer.country ?? "Türkiye").up();
    country.up();
    addr.up();
  }
  customerParty.up().up(); // close Party, AccountingCustomerParty

  // ── TaxTotal ──
  const taxTotal = doc.ele(NS.cac, "TaxTotal");
  taxTotal
    .ele(NS.cbc, "TaxAmount")
    .att("currencyID", data.currency)
    .txt(formatAmount(data.taxTotal))
    .up();

  // Group line items by KDV rate for TaxSubtotal elements
  const rateGroups = new Map<number, number>();
  for (const item of data.lineItems) {
    rateGroups.set(item.kdvRate, (rateGroups.get(item.kdvRate) ?? 0) + item.kdvAmount);
  }

  for (const [rate, amount] of rateGroups) {
    const subtotal = taxTotal.ele(NS.cac, "TaxSubtotal");
    subtotal
      .ele(NS.cbc, "TaxableAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(data.lineItems.filter(l => l.kdvRate === rate).reduce((s, l) => s + l.lineTotal, 0)))
      .up();
    subtotal
      .ele(NS.cbc, "TaxAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(amount))
      .up();
    subtotal
      .ele(NS.cbc, "Percent")
      .txt(formatAmount(rate))
      .up();

    const taxCategory = subtotal.ele(NS.cac, "TaxCategory");
    const taxScheme = taxCategory.ele(NS.cac, "TaxScheme");
    taxScheme.ele(NS.cbc, "Name").txt("KDV").up();
    taxScheme.ele(NS.cbc, "TaxTypeCode").txt("0015").up();
    taxScheme.up();
    taxCategory.up();
    subtotal.up();
  }
  taxTotal.up();

  // ── LegalMonetaryTotal ──
  const monetary = doc.ele(NS.cac, "LegalMonetaryTotal");
  monetary
    .ele(NS.cbc, "LineExtensionAmount")
    .att("currencyID", data.currency)
    .txt(formatAmount(data.lineExtensionAmount))
    .up();
  monetary
    .ele(NS.cbc, "TaxExclusiveAmount")
    .att("currencyID", data.currency)
    .txt(formatAmount(data.lineExtensionAmount))
    .up();
  monetary
    .ele(NS.cbc, "TaxInclusiveAmount")
    .att("currencyID", data.currency)
    .txt(formatAmount(data.taxInclusiveAmount))
    .up();
  monetary
    .ele(NS.cbc, "PayableAmount")
    .att("currencyID", data.currency)
    .txt(formatAmount(data.taxInclusiveAmount))
    .up();
  monetary.up();

  // ── InvoiceLine(s) ──
  for (const item of data.lineItems) {
    const line = doc.ele(NS.cac, "InvoiceLine");
    line.ele(NS.cbc, "ID").txt(String(item.id)).up();
    line
      .ele(NS.cbc, "InvoicedQuantity")
      .att("unitCode", "C62") // UN/ECE unit code for "one" (piece)
      .txt(formatAmount(item.quantity, 4))
      .up();
    line
      .ele(NS.cbc, "LineExtensionAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(item.lineTotal))
      .up();

    // Line-level TaxTotal
    const lineTax = line.ele(NS.cac, "TaxTotal");
    lineTax
      .ele(NS.cbc, "TaxAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(item.kdvAmount))
      .up();

    const lineSub = lineTax.ele(NS.cac, "TaxSubtotal");
    lineSub
      .ele(NS.cbc, "TaxableAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(item.lineTotal))
      .up();
    lineSub
      .ele(NS.cbc, "TaxAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(item.kdvAmount))
      .up();
    lineSub.ele(NS.cbc, "Percent").txt(formatAmount(item.kdvRate)).up();
    const lineCat = lineSub.ele(NS.cac, "TaxCategory");
    const lineScheme = lineCat.ele(NS.cac, "TaxScheme");
    lineScheme.ele(NS.cbc, "Name").txt("KDV").up();
    lineScheme.ele(NS.cbc, "TaxTypeCode").txt("0015").up();
    lineScheme.up();
    lineCat.up();
    lineSub.up();
    lineTax.up();

    // Item
    const itemEle = line.ele(NS.cac, "Item");
    itemEle.ele(NS.cbc, "Description").txt(item.description).up();
    itemEle.ele(NS.cbc, "Name").txt(item.description).up();
    itemEle.up();

    // Price
    const price = line.ele(NS.cac, "Price");
    price
      .ele(NS.cbc, "PriceAmount")
      .att("currencyID", data.currency)
      .txt(formatAmount(item.unitPrice, 4))
      .up();
    price.up();

    line.up();
  }

  doc.up(); // close Invoice

  return doc.end({ prettyPrint: true });
}

// ── Invoice ID generator ────────────────────────────────────────────

/**
 * Generate a GIB-compliant invoice ID.
 *
 * Format: 3-letter series prefix + 4-digit year + 9-digit sequence number.
 * Example: TST2024000000001
 *
 * @param series - 3-letter series prefix (default: 'TST' for sandbox)
 * @param year - 4-digit year
 * @param sequence - sequence number (1-999999999)
 */
export function generateInvoiceId(
  series = "TST",
  year: number = new Date().getFullYear(),
  sequence = 1,
): string {
  const s = series.toUpperCase().padEnd(3, "X").slice(0, 3);
  const y = String(year).slice(-4);
  const seq = String(sequence).padStart(9, "0");
  return `${s}${y}${seq}`;
}
