import { describe, it, expect, vi, beforeAll } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Mock server-only — this package throws at import time in non-Next.js environments.
 * Must be top of file, before anything that transitively imports it.
 */
vi.mock("server-only", () => ({}));

/**
 * Mock Clerk so the tRPC context builder doesn't hit real Clerk APIs.
 * Must be declared before any dynamic imports of the route handler.
 */
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null }),
}));

// Skip t3-env validation — we're not testing env here
process.env.SKIP_ENV_VALIDATION = "1";

// Provide minimal env values the supabase/trpc modules reference at init
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/trpc/[trpc]/route");
  GET = mod.GET;
  POST = mod.POST;
});

describe("tRPC HTTP handler", () => {
  it("GET /api/trpc/healthcheck returns HTTP 200", async () => {
    const req = new Request(
      "http://localhost:3000/api/trpc/healthcheck",
      { method: "GET" },
    ) as unknown as NextRequest;

    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it("GET /api/trpc/healthcheck returns JSON with result.data === 'ok'", async () => {
    const req = new Request(
      "http://localhost:3000/api/trpc/healthcheck",
      { method: "GET" },
    ) as unknown as NextRequest;

    const res = await GET(req);
    const json = (await res.json()) as {
      result?: { data?: { json?: unknown } };
    };

    expect(json).toHaveProperty("result");
    // superjson serialises the string "ok" as { json: "ok" }
    expect(json.result?.data).toStrictEqual({ json: "ok" });
  });

  it("POST to unknown procedure returns HTTP 404", async () => {
    const req = new Request(
      "http://localhost:3000/api/trpc/does.not.exist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    ) as unknown as NextRequest;

    const res = await POST(req);

    // tRPC returns 404 for unregistered procedures
    expect(res.status).toBe(404);
  });
});
