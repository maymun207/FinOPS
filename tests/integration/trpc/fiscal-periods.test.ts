/**
 * @vitest-environment node
 *
 * Integration tests: Fiscal Periods tRPC router
 *
 * Test cases:
 * 1. closePeriod mutation sets is_closed=true and closed_at within 5 seconds of now
 * 2. closePeriod on already-closed period → returns error 'Period already closed'
 * 3. openPeriod mutation re-opens a closed period
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

process.env.SKIP_ENV_VALIDATION = "1";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";

import {
  setupTestDb,
  teardownTestDb,
  getTestDbUrl,
  validateConnection,
} from "../setup";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schemaTypes from "@/server/db/schema";

await validateConnection();
const DB_URL = getTestDbUrl();

describe.skipIf(!DB_URL)("Fiscal Periods — tRPC router", () => {
  let db: NodePgDatabase<typeof schemaTypes>;
  let testCompanyId: string;
  let testPeriodId: string;
  const testOrgId = `org_fp_test_${Date.now()}`;
  const testUserId = `user_fp_test_${Date.now()}`;

  let appRouter: typeof import("@/server/trpc/root").appRouter;
  let createCallerFactory: typeof import("@/server/trpc/trpc").createCallerFactory;

  function createAuthenticatedCaller() {
    return createCallerFactory(appRouter)({
      db: db as any,
      userId: testUserId,
      orgId: testOrgId,
      companyId: testCompanyId,
      headers: new Headers(),
    });
  }

  beforeAll(async () => {
    const setup = setupTestDb();
    db = setup.db;

    // Create test company
    const companyResult = await db.execute(sql`
      INSERT INTO companies (clerk_org_id, name)
      VALUES (${testOrgId}, 'Fiscal Period Test Co')
      RETURNING id
    `);
    testCompanyId = (companyResult.rows[0] as Record<string, unknown>)[
      "id"
    ] as string;

    // Create an open fiscal period
    const periodResult = await db.execute(sql`
      INSERT INTO fiscal_periods (company_id, name, start_date, end_date, is_closed)
      VALUES (${testCompanyId}, '2026-Q1', '2026-01-01', '2026-03-31', false)
      RETURNING id
    `);
    testPeriodId = (periodResult.rows[0] as Record<string, unknown>)[
      "id"
    ] as string;

    mockAuth.mockResolvedValue({
      userId: testUserId,
      orgId: testOrgId,
    });

    const rootMod = await import("@/server/trpc/root");
    const trpcMod = await import("@/server/trpc/trpc");
    appRouter = rootMod.appRouter;
    createCallerFactory = trpcMod.createCallerFactory;
  });

  afterAll(async () => {
    if (testCompanyId) {
      await db.execute(
        sql`DELETE FROM fiscal_periods WHERE company_id = ${testCompanyId}`
      );
      await db.execute(
        sql`DELETE FROM audit_log WHERE company_id = ${testCompanyId}`
      );
      await db.execute(
        sql`DELETE FROM companies WHERE id = ${testCompanyId}`
      );
    }
    await teardownTestDb();
  });

  it("closePeriod mutation sets is_closed=true and closed_at within 5 seconds of now", async () => {
    const caller = createAuthenticatedCaller();
    const beforeClose = new Date();

    const result = await caller.fiscalPeriod.closePeriod({
      periodId: testPeriodId,
      confirmation: "2026-Q1",
    });

    expect(result.isClosed).toBe(true);
    expect(result.closedAt).not.toBeNull();
    expect(result.closedBy).toBe(testUserId);

    // closed_at should be within 5 seconds of now
    const closedAt = new Date(result.closedAt!);
    const diffMs = closedAt.getTime() - beforeClose.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(0);
    expect(diffMs).toBeLessThan(5_000);
  });

  it("closePeriod on already-closed period returns error 'Period already closed'", async () => {
    const caller = createAuthenticatedCaller();

    // Period was closed in the previous test — try to close again
    await expect(
      caller.fiscalPeriod.closePeriod({ periodId: testPeriodId, confirmation: "2026-Q1" })
    ).rejects.toThrow("Period is already closed");
  });

  it("openPeriod mutation re-opens a closed period", async () => {
    const caller = createAuthenticatedCaller();

    const result = await caller.fiscalPeriod.openPeriod({
      periodId: testPeriodId,
    });

    expect(result.isClosed).toBe(false);
    expect(result.closedAt).toBeNull();
    expect(result.closedBy).toBeNull();
  });

  it("closePeriod on non-existent period returns NOT_FOUND", async () => {
    const caller = createAuthenticatedCaller();

    await expect(
      caller.fiscalPeriod.closePeriod({
        periodId: "00000000-0000-0000-0000-000000000000",
        confirmation: "2026-Q1",
      })
    ).rejects.toThrow("Fiscal period not found");
  });
});
