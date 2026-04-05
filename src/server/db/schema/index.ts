/**
 * Schema barrel — re-exports all table definitions.
 * Import from here rather than individual schema files.
 */

// ── Foundation ──────────────────────────────────────────────────────
export { companies } from "./companies";
export { fiscalPeriods } from "./fiscal-periods";
export { auditLog } from "./audit-log";
export { columnMappingProfiles } from "./column-mapping-profiles";

// ── Accounting ──────────────────────────────────────────────────────
export { chartOfAccounts } from "./chart-of-accounts";
export { contacts } from "./contacts";
export { categoryMappings } from "./category-mappings";
export { invoices } from "./invoices";
export { invoiceLineItems } from "./invoice-line-items";
export { journalEntries } from "./journal-entries";
export { journalEntryLines } from "./journal-entry-lines";
export { payments } from "./payments";

// ── Operations ──────────────────────────────────────────────────────
export { importQuarantine } from "./import-quarantine";
export { aiQueryLog } from "./ai-query-log";
