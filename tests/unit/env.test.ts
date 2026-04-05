// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * This test file uses the Node environment (not jsdom) so that
 * t3-env's server/client variable guard works correctly.
 *
 * vi.isolateModules() is used to ensure env.ts is re-evaluated
 * from scratch on every test with the correct process.env state.
 */

const REQUIRED_ENV: Record<string, string> = {
  // Public (client-side)
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_xxx",
  // Server-only
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  SUPABASE_DB_URL: "postgresql://postgres:password@localhost:5432/postgres",
  CLERK_SECRET_KEY: "sk_test_xxx",
  CLERK_SUPABASE_JWT_TEMPLATE: "supabase",
  TRIGGER_SECRET_KEY: "tr_dev_xxx",
  CLOUDFLARE_R2_ACCOUNT_ID: "abc123",
  CLOUDFLARE_R2_ACCESS_KEY_ID: "test-key-id",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: "test-secret",
  CLOUDFLARE_R2_BUCKET_NAME: "finops-imports",
  GEMINI_API_KEY: "AIza-test",
  RESEND_API_KEY: "re_test_xxx",
};

const ALL_KEYS = Object.keys(REQUIRED_ENV);

function seedEnv(overrides: Record<string, string | undefined> = {}): void {
  const merged = { ...REQUIRED_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Import env.ts fresh on every call by resetting the module registry first.
 * This ensures each test sees a completely re-evaluated env.ts with its
 * own process.env state.
 */
async function importEnv() {
  vi.resetModules();
  return import("@/env");
}

describe("t3-env — createEnv validation", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    for (const key of ALL_KEYS) delete process.env[key];
    // Ensure t3-env runs its validation (not skipped)
    delete process.env.SKIP_ENV_VALIDATION;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  // ------------------------------------------------------------------ //
  // PASSING CASE
  // ------------------------------------------------------------------ //

  it("passes with all required variables present", async () => {
    seedEnv();
    const mod = await importEnv();
    expect(mod.env).toBeDefined();
    expect(mod.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });

  // ------------------------------------------------------------------ //
  // MISSING VARIABLE CASES  (t3-env should throw)
  // ------------------------------------------------------------------ //

  it("throws when GEMINI_API_KEY is missing", async () => {
    seedEnv({ GEMINI_API_KEY: undefined });
    await expect(importEnv()).rejects.toThrow();
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    seedEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    await expect(importEnv()).rejects.toThrow();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    seedEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined });
    await expect(importEnv()).rejects.toThrow();
  });

  it("throws when CLERK_SECRET_KEY is missing", async () => {
    seedEnv({ CLERK_SECRET_KEY: undefined });
    await expect(importEnv()).rejects.toThrow();
  });

  // ------------------------------------------------------------------ //
  // INVALID FORMAT CASES
  // ------------------------------------------------------------------ //

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL", async () => {
    seedEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    await expect(importEnv()).rejects.toThrow();
  });

  it("throws when SUPABASE_DB_URL is not a valid URL", async () => {
    seedEnv({ SUPABASE_DB_URL: "bad-db-url" });
    await expect(importEnv()).rejects.toThrow();
  });
});
