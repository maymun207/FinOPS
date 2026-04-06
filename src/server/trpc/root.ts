import "server-only";
import { createTRPCRouter, publicProcedure } from "./trpc";
import { companiesRouter } from "./routers/companies";
import { chartOfAccountsRouter } from "./routers/chart-of-accounts";
import { fiscalPeriodsRouter } from "./routers/fiscal-periods";
import { journalEntriesRouter } from "./routers/journal-entries";
import { contactsRouter } from "./routers/contacts";
import { invoicesRouter } from "./routers/invoices";
import { categoryMappingsRouter } from "./routers/category-mappings";
import { dashboardRouter } from "./routers/dashboard";
import { paymentsRouter } from "./routers/payments";
import { auditLogRouter } from "./routers/audit-log";
import { importRouter } from "./routers/import";
import { quarantineRouter } from "./routers/quarantine";
import { jobsRouter } from "./routers/jobs";
import { reportsRouter } from "./routers/reports";
import { exportsRouter } from "./routers/exports";
import { cfoRouter } from "./routers/cfo";
import { gibRouter } from "./routers/gib";

/**
 * Root tRPC router — aggregates all sub-routers.
 *
 * Route structure:
 *   /api/trpc/healthcheck                   — public health check
 *   /api/trpc/company.getCurrent            — current user's company
 *   /api/trpc/coa.list                      — chart of accounts (template + company)
 *   /api/trpc/coa.getByCode                 — single account lookup by code
 *   /api/trpc/fiscalPeriod.list             — fiscal periods
 *   /api/trpc/fiscalPeriod.getCurrent       — current open period
 *   /api/trpc/fiscalPeriod.closePeriod      — close a period
 *   /api/trpc/fiscalPeriod.openPeriod       — reopen a period
 *   /api/trpc/journal.list                  — journal entry lines (flattened)
 *   /api/trpc/journal.getById               — single journal entry + lines
 *   /api/trpc/journal.create                — create entry with lines
 *   /api/trpc/contact.list                  — contacts list
 *   /api/trpc/contact.getById               — single contact
 *   /api/trpc/contact.create                — create contact
 *   /api/trpc/contact.update                — update contact
 *   /api/trpc/contact.delete                — delete contact
 *   /api/trpc/invoice.list                  — invoices list
 *   /api/trpc/invoice.getById               — single invoice + line items
 *   /api/trpc/invoice.create                — create invoice + auto-journal
 *   /api/trpc/invoice.delete                — delete invoice + cascade journal
 *   /api/trpc/categoryMapping.list          — category mappings
 *   /api/trpc/categoryMapping.create        — create mapping
 *   /api/trpc/categoryMapping.update        — update mapping
 *   /api/trpc/categoryMapping.delete        — delete mapping
 */
export const appRouter = createTRPCRouter({
  /**
   * Health-check — used by integration tests and uptime monitors.
   * GET /api/trpc/healthcheck → { result: { data: "ok" } }
   */
  healthcheck: publicProcedure.query(() => "ok" as const),

  /** Companies — current user's company */
  company: companiesRouter,

  /** Chart of Accounts — TDHP accounts */
  coa: chartOfAccountsRouter,

  /** Fiscal Periods — manage accounting periods */
  fiscalPeriod: fiscalPeriodsRouter,

  /** Journal Entries — yevmiye defteri */
  journal: journalEntriesRouter,

  /** Contacts — cari kartlar (müşteri/tedarikçi) */
  contact: contactsRouter,

  /** Invoices — fatura yönetimi */
  invoice: invoicesRouter,

  /** Category Mappings — kategori ↔ TDHP eşleştirme */
  categoryMapping: categoryMappingsRouter,

  /** Dashboard — KPI aggregation */
  dashboard: dashboardRouter,

  /** Payments — ödeme kaydı + journal entry */
  payment: paymentsRouter,

  /** Audit Log — immutable log viewer (admin) */
  auditLog: auditLogRouter,

  /** Import Pipeline — Excel/CSV upload → quarantine */
  import: importRouter,

  /** Quarantine — review, approve, reject imported records */
  quarantine: quarantineRouter,

  /** Jobs — Trigger.dev background jobs (import, reports, sync) */
  job: jobsRouter,

  /** Reports — DuckDB analytical views (mizan, gelir tablosu, etc.) */
  report: reportsRouter,

  /** Exports — Excel data exports (hareketler, cariler, faturalar) */
  export: exportsRouter,

  /** Virtual CFO — AI-powered financial assistant */
  cfo: cfoRouter,

  /** GIB e-Fatura — electronic invoice submission + status */
  gib: gibRouter,
});

export type AppRouter = typeof appRouter;
