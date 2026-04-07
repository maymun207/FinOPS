/**
 * @vitest-environment node
 *
 * Unit tests: companyProcedure middleware guard
 *
 * Verifies that the tRPC companyProcedure middleware:
 * 1. Throws FORBIDDEN when ctx.companyId is null/empty (no org selected)
 * 2. Throws UNAUTHORIZED when ctx.userId is null (unauthenticated)
 * 3. Resolves with ctx.companyId typed as string when both are present
 *
 * No database required — tests the middleware in isolation using a
 * minimal tRPC caller with stubbed context.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Must be at the top, before any dynamic imports that transitively import these.
vi.mock("server-only", () => ({}));

// Stub Axiom telemetry — no AXIOM_TOKEN in test environment
vi.mock("@/lib/telemetry/axiom", () => ({
  log: vi.fn(),
}));

// Stub OpenTelemetry spans — no OTEL exporter in test environment
vi.mock("@/lib/telemetry/otel", () => ({
  withSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

// Stub env validation — avoids needing all env vars in test
process.env.SKIP_ENV_VALIDATION = "1";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";

import { describe, it, expect, vi } from "vitest";
import { createCallerFactory, createTRPCRouter, companyProcedure } from "@/server/trpc/trpc";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Minimal TRPCContext stub — only the fields the middleware checks.
 */
function makeCtx(overrides: {
  userId?: string | null;
  companyId?: string | null;
  orgId?: string | null;
}) {
  return {
    db: {} as never,
    userId: overrides.userId ?? null,
    orgId: overrides.orgId ?? null,
    companyId: overrides.companyId ?? null,
    headers: new Headers(),
  };
}

/** Minimal router with one companyProcedure endpoint for guard testing */
const testRouter = createTRPCRouter({
  ping: companyProcedure.query(({ ctx }) => ({
    companyId: ctx.companyId, // string — not string | null (narrowed by guard)
    userId: ctx.userId,
    orgId: ctx.orgId,
  })),
});

const createCaller = createCallerFactory(testRouter);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("companyProcedure guard", () => {
  it("throws FORBIDDEN when companyId is null (no org selected)", async () => {
    const caller = createCaller(
      makeCtx({ userId: "user_123", companyId: null, orgId: null })
    );

    await expect(caller.ping()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Şirket bağlamı bulunamadı. Lütfen bir organizasyon seçin.",
    });
  });

  it("throws FORBIDDEN when companyId is empty string", async () => {
    const caller = createCaller(
      makeCtx({ userId: "user_123", companyId: "", orgId: "org_xyz" })
    );

    await expect(caller.ping()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Şirket bağlamı bulunamadı. Lütfen bir organizasyon seçin.",
    });
  });

  it("throws UNAUTHORIZED when userId is null (unauthenticated)", async () => {
    const caller = createCaller(
      makeCtx({ userId: null, companyId: null, orgId: null })
    );

    await expect(caller.ping()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("throws UNAUTHORIZED even when companyId is present but userId is null", async () => {
    // userId check runs before companyId check — UNAUTHORIZED takes priority
    const caller = createCaller(
      makeCtx({ userId: null, companyId: "some-company-id", orgId: "org_xyz" })
    );

    await expect(caller.ping()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("resolves and returns companyId as string when both userId and companyId are present", async () => {
    const caller = createCaller(
      makeCtx({
        userId: "user_abc",
        companyId: "company-uuid-123",
        orgId: "org_xyz",
      })
    );

    const result = await caller.ping();
    expect(result.companyId).toBe("company-uuid-123");
    expect(typeof result.companyId).toBe("string");
    expect(result.userId).toBe("user_abc");
    expect(result.orgId).toBe("org_xyz");
  });

  it("context companyId is typed as string (not string | null) — verified at runtime", async () => {
    // This test catches any regression where the type narrowing is removed.
    // If companyId were string | null, `.length` would need a null check.
    const caller = createCaller(
      makeCtx({
        userId: "user_xyz",
        companyId: "abc-def-123",
        orgId: "org_abc",
      })
    );

    const result = await caller.ping();
    // This would throw at runtime if companyId were null
    expect(result.companyId.length).toBeGreaterThan(0);
  });
});
