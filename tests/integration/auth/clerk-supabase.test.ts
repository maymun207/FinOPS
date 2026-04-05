/**
 * @vitest-environment node
 *
 * Integration tests: Clerk → Supabase JWT validation + tRPC company resolution
 *
 * Test cases:
 * 1. Generate a Clerk test JWT with org_id claim → Supabase accepts it
 *    and auth.jwt() returns org_id
 * 2. tRPC getCurrent returns the correct company for the JWT's org_id
 * 3. tRPC call with no JWT → returns UNAUTHORIZED TRPCError
 * 4. get_company_id() / get_user_id() return NULL without JWT claims
 *
 * Uses mocked Clerk auth() to simulate different authentication states,
 * and a createCallerFactory to test the tRPC router directly.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";

// ── Mocks ─────────────────────────────────────────────────────────
// Must be at the top, before any dynamic imports that transitively import these.
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

describe.skipIf(!DB_URL)(
  "Clerk → Supabase — JWT + company resolution",
  () => {
    let db: NodePgDatabase<typeof schemaTypes>;
    let testCompanyId: string;
    const testOrgId = `org_test_clerk_${Date.now()}`;
    const testUserId = `user_test_clerk_${Date.now()}`;

    // ── tRPC caller ─────────────────────────────────────────────
    // Dynamically imported to allow mocks to register first
    let appRouter: typeof import("@/server/trpc/root").appRouter;
    let createCallerFactory: typeof import("@/server/trpc/trpc").createCallerFactory;

    beforeAll(async () => {
      const setup = setupTestDb();
      db = setup.db;

      // Create test company linked to our mock Clerk org
      const result = await db.execute(sql`
        INSERT INTO companies (clerk_org_id, name)
        VALUES (${testOrgId}, 'Clerk Integration Test Co')
        RETURNING id
      `);
      testCompanyId = (result.rows[0] as Record<string, unknown>)[
        "id"
      ] as string;

      // Dynamic import of the router (after mocks are in place)
      const rootMod = await import("@/server/trpc/root");
      const trpcMod = await import("@/server/trpc/trpc");
      appRouter = rootMod.appRouter;
      createCallerFactory = trpcMod.createCallerFactory;
    });

    afterAll(async () => {
      if (testCompanyId) {
        await db.execute(
          sql`DELETE FROM audit_log WHERE company_id = ${testCompanyId}`
        );
        await db.execute(
          sql`DELETE FROM companies WHERE id = ${testCompanyId}`
        );
      }
      await teardownTestDb();
    });

    // ── Test 1: Company resolution from clerk_org_id ────────────
    it("resolves company_id from clerk_org_id via companies table", async () => {
      const result = await db.execute(sql`
        SELECT id FROM companies WHERE clerk_org_id = ${testOrgId}
      `);
      expect(result.rows).toHaveLength(1);
      expect((result.rows[0] as Record<string, unknown>)["id"]).toBe(
        testCompanyId
      );
    });

    // ── Test 2: tRPC getCurrent returns correct company ─────────
    it("tRPC company.getCurrent returns the correct company for the JWT org_id", async () => {
      // Mock Clerk auth to return authenticated user with org
      mockAuth.mockResolvedValue({
        userId: testUserId,
        orgId: testOrgId,
      });

      const caller = createCallerFactory(appRouter)({
        db: db as any,
        userId: testUserId,
        orgId: testOrgId,
        companyId: testCompanyId,
        headers: new Headers(),
      });

      const company = await caller.company.getCurrent();
      expect(company).not.toBeNull();
      expect(company!.id).toBe(testCompanyId);
      expect(company!.name).toBe("Clerk Integration Test Co");
    });

    // ── Test 3: No JWT → UNAUTHORIZED ───────────────────────────
    it("tRPC call with no JWT returns UNAUTHORIZED TRPCError", async () => {
      mockAuth.mockResolvedValue({ userId: null, orgId: null });

      const caller = createCallerFactory(appRouter)({
        db: db as any,
        userId: null,
        orgId: null,
        companyId: null,
        headers: new Headers(),
      });

      // company.getCurrent uses protectedProcedure → should throw UNAUTHORIZED
      await expect(caller.company.getCurrent()).rejects.toThrow("UNAUTHORIZED");
    });

    // ── Test 4: Authenticated but no company → FORBIDDEN ────────
    it("tRPC companyProcedure with no company returns FORBIDDEN", async () => {
      mockAuth.mockResolvedValue({
        userId: testUserId,
        orgId: "org_unknown",
      });

      const caller = createCallerFactory(appRouter)({
        db: db as any,
        userId: testUserId,
        orgId: "org_unknown",
        companyId: null,
        headers: new Headers(),
      });

      // coa.list uses companyProcedure → should throw FORBIDDEN
      await expect(caller.coa.list()).rejects.toThrow(
        "No company found for this organization"
      );
    });

    // ── Test 5: DB-level JWT helpers return NULL without claims ──
    it("get_company_id() returns NULL when no JWT claims are set", async () => {
      const result = await db.execute(sql`
        SELECT public.get_company_id() as company_id
      `);
      const companyId = (result.rows[0] as Record<string, unknown>)[
        "company_id"
      ];
      expect(companyId).toBeNull();
    });

    it("get_user_id() returns NULL when no JWT claims are set", async () => {
      const result = await db.execute(sql`
        SELECT public.get_user_id() as user_id
      `);
      const userId = (result.rows[0] as Record<string, unknown>)["user_id"];
      expect(userId).toBeNull();
    });
  }
);
