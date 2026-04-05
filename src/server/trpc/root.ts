import "server-only";
import { createTRPCRouter, publicProcedure } from "./trpc";
import { companiesRouter } from "./routers/companies";
import { chartOfAccountsRouter } from "./routers/chart-of-accounts";
import { fiscalPeriodsRouter } from "./routers/fiscal-periods";

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
});

export type AppRouter = typeof appRouter;
