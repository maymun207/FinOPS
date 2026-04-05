---
name: nextjs-saas-stack
description: >
  Reusable setup patterns, pitfalls, and decisions for the Next.js 15 + tRPC + Supabase + Clerk + Drizzle 
  SaaS stack. Use this skill when bootstrapping a new SaaS project with this stack — avoids re-learning 
  the same lessons from scratch.
---

# Next.js SaaS Stack — Reusable Playbook

> Stack: **Next.js 15 (App Router)** · **tRPC v11** · **Supabase** · **Clerk** · **Drizzle ORM** · **Zustand** · **Vitest**

Use this as the starting point for any new project on this stack.

---

## 1. Package Setup

### Core dependencies (exact versions — critical for React 19 compatibility)
```jsonc
{
  // tRPC — pin exact, NO ^ prefix (React 19 type compat is fragile)
  "@trpc/client":       "11.16.0",
  "@trpc/react-query":  "11.16.0",
  "@trpc/server":       "11.16.0",
  // Do NOT install @trpc/next — it is Pages Router only

  // tRPC peer
  "@tanstack/react-query": "^5.96.2",
  "superjson": "^2.x",

  // Auth
  "@clerk/nextjs": "^7.x",

  // DB
  "@supabase/ssr": "^0.10.x",
  "@supabase/supabase-js": "^2.x",
  "drizzle-orm": "^0.45.x",
  "pg": "^8.x",

  // Env validation
  "@t3-oss/env-nextjs": "^0.13.x",
  "zod": "^4.x",   // Note: Zod v4 API changes below

  // State
  "zustand": "^5.x"
}
```

### Dev dependencies
```jsonc
{
  "drizzle-kit": "^0.30.x",
  "typescript": "^5.x",
  "vitest": "^4.x",
  "@vitest/ui": "^4.x",
  "@testing-library/react": "^16.x",
  "jsdom": "^26.x",
  "@types/node": "^22.x",
  "@eslint/js": "^10.x",
  "@typescript-eslint/eslint-plugin": "^8.x",
  "@typescript-eslint/parser": "^8.x"
}
```

### package.json required fields
```jsonc
{
  "type": "module",   // Required for ESLint flat config (eslint.config.js as ESM)
  "scripts": {
    "dev": "next dev",
    "lint": "eslint . --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "ci:check": "pnpm type-check && pnpm lint && pnpm test"
  }
}
```

---

## 2. File Structure (Minimal Scaffold)

```
src/
├── app/
│   ├── api/trpc/[trpc]/route.ts   — tRPC HTTP handler
│   ├── layout.tsx                  — ClerkProvider > TRPCReactProvider
│   ├── page.tsx
│   └── globals.css
├── env.ts                          — t3-env schema (ALL vars validated here)
├── middleware.ts                   — clerkMiddleware() — REQUIRED
├── lib/
│   ├── supabase/
│   │   ├── client.ts              — browser client (anon key only)
│   │   └── server.ts              — server client (MUST start with import "server-only")
│   └── trpc/
│       └── client.tsx             — TRPCReactProvider (.tsx not .ts — contains JSX)
├── server/
│   ├── db/
│   │   └── schema.ts              — Drizzle schema
│   └── trpc/
│       ├── trpc.ts                — initTRPC + context + publicProcedure + protectedProcedure
│       └── root.ts                — appRouter (combine sub-routers here)
├── store/
│   └── index.ts                   — Zustand root store (slice pattern)
└── test/
    └── setup.ts                   — Vitest global setup
tests/
├── unit/
│   └── env.test.ts                — t3-env validation tests
└── integration/
    └── trpc-handler.test.ts       — tRPC HTTP handler tests
```

---

## 3. Critical Pitfalls — Read Before Implementing

| # | Pitfall | Correct Pattern |
|---|---------|----------------|
| 1 | Supabase service role key in client code | `import "server-only"` as **first line** of `server.ts` |
| 2 | `@trpc/next` installed | Remove it — Pages Router only, breaks App Router builds |
| 3 | `^` on tRPC packages | Exact pin: `"11.16.0"` not `"^11.16.0"` |
| 4 | ClerkProvider inside TRPCReactProvider | `ClerkProvider` must be **outermost** |
| 5 | `createNextApiHandler` for tRPC | Use `fetchRequestHandler` (App Router) |
| 6 | `middleware.ts` missing | Clerk will throw `auth() called without clerkMiddleware()` at runtime |
| 7 | tRPC client file as `.ts` | Must be `.tsx` if it returns JSX |
| 8 | `z.string().url()` in Zod v4 | Use `z.url()` directly |
| 9 | `zodError.flatten()` in Zod v4 | Use `z.treeifyError(zodError)` |
| 10 | ESLint `process` not defined | Add `process: "readonly"` to ESLint globals |

---

## 4. Key File Templates

### `src/middleware.ts`
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/trpc/healthcheck",  // uptime monitor
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### `src/env.ts` (Zod v4 patterns)
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),          // z.url() not z.string().url()
    SECRET_KEY:   z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    DATABASE_URL:       process.env.DATABASE_URL,
    SECRET_KEY:         process.env.SECRET_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### `src/server/trpc/trpc.ts` (Zod v4 errorFormatter)
```typescript
errorFormatter({ shape, error }) {
  return {
    ...shape,
    data: {
      ...shape.data,
      // z.treeifyError() — NOT error.cause.flatten() (deprecated in Zod v4)
      zodError: error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
    },
  };
},
```

### Root router — always add `healthcheck`
```typescript
export const appRouter = createTRPCRouter({
  healthcheck: publicProcedure.query(() => "ok" as const),
  // sub-routers...
});
```

### `src/app/layout.tsx` — provider order
```tsx
// ClerkProvider OUTSIDE TRPCReactProvider — always
<ClerkProvider>
  <TRPCReactProvider>
    {children}
  </TRPCReactProvider>
</ClerkProvider>
```

---

## 5. Testing Patterns

### Env validation tests (t3-env)
```typescript
// @vitest-environment node   ← REQUIRED (not jsdom — server/client guard)
// Use vi.resetModules() + dynamic import for per-test isolation
async function importEnv() {
  vi.resetModules();
  return import("@/env");
}
// Delete process.env.SKIP_ENV_VALIDATION in beforeEach
```

### tRPC handler integration test
```typescript
// Mock Clerk before any imports
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null }),
}));
process.env.SKIP_ENV_VALIDATION = "1";
// superjson wraps string "ok" as { json: "ok" } in response
```

---

## 6. Drizzle + Supabase RLS Pattern

### Base columns for every table
```typescript
const baseColumns = {
  id:        uuid("id").primaryKey().defaultRandom(),
  orgId:     uuid("org_id").notNull(),   // Clerk org_id → tenant isolation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),         // Clerk userId
};
```

### RLS policy template
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON <table>
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

### Supabase JWT config (Clerk → Supabase)
- Create JWT template named `supabase` in Clerk dashboard
- Template payload: `{ "role": "authenticated", "org_id": "{{org.id}}" }`
- Set env: `CLERK_SUPABASE_JWT_TEMPLATE=supabase`

---

## 7. Verification Checklist (Run Before First Feature)

```bash
pnpm tsc --noEmit          # exit 0 — zero TS errors
pnpm lint                  # exit 0 — zero lint warnings
pnpm test                  # exit 0 — all tests pass
# Start dev + curl /api/trpc/healthcheck → HTTP 200
```

---

## 8. Changelog

| Date | Project | Learning Added |
|------|---------|----------------|
| 2026-04-05 | FinOPS | Initial playbook created from full stack setup |
