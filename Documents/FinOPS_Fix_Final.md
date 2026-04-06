# FinOPS — Fix Everything Properly
## AntiGravity + Opus 4.6 Extended Thinking

---

## READ THIS FIRST BEFORE TOUCHING ANYTHING

You are fixing real bugs in a financial platform. Previous fix attempts skipped steps,
made failures non-blocking instead of fixing them, and reported success when nothing worked.

**You must not do that. Here is how this session works:**

1. You do ONE step at a time.
2. After each step, you paste the **exact current file content** as proof.
3. If the proof shows the fix is not there, you fix it. No moving on.
4. You never make a CI step `continue-on-error` or `non-blocking` to hide a failure.
   You fix the actual failure instead.
5. If you cannot fix something, say so clearly. Do not pretend it is done.
6. At the end of every step you write either `STEP COMPLETE ✓` or `STEP FAILED — reason`.

There are 7 steps. Do them in order. Do not skip any.

---

## CURRENT KNOWN PROBLEMS (audit confirmed)

From reading the live repo these are confirmed unfixed:

- `trigger.config.ts` still has `ignorePatterns` block — 4 jobs excluded from Trigger.dev
- `drizzle.config.ts` still uses `SUPABASE_DB_URL` for migrations (wrong — needs session pooler URL)  
- `.env.example` still has `CLERK_SUPABASE_JWT_TEMPLATE` (deprecated) and missing `SUPABASE_DB_URL_UNPOOLED`
- `README.md` still says `npm install` / `npm run dev` and still lists `CLERK_SUPABASE_JWT_TEMPLATE`
- CI workflow has lint set to non-blocking and build set to `continue-on-error` — hiding real failures
- There are 11 real lint errors in `import/page.tsx`, `contacts/page.tsx`, `contacts/new/page.tsx`
- There is a `node:crypto` build error being silently ignored

---

## STEP 1 — Fix the CI lint errors (real code bugs)

### What you must do

Read these files in full:
- `src/app/(dashboard)/import/page.tsx`
- `src/app/(dashboard)/contacts/page.tsx`
- `src/app/(dashboard)/contacts/new/page.tsx`

Fix every lint error. The known errors from the CI output are:

**Error type 1 — Returning void from arrow shorthand (found in all three files)**

```typescript
// WRONG — void expression in shorthand arrow
onClick={() => someAsyncFunction()}

// CORRECT — add braces
onClick={() => { someAsyncFunction(); }}

// ALSO CORRECT if you need to handle the promise
onClick={() => { void someAsyncFunction(); }}
```

**Error type 2 — Array<T> syntax (import/page.tsx line 90)**

```typescript
// WRONG
Array<string>

// CORRECT
string[]
```

**Error type 3 — Unused variable 'result' (import/page.tsx line 46)**

```typescript
// WRONG — result is assigned but never used
const result = await someFunction()

// CORRECT — either use it or prefix with underscore
const _result = await someFunction()
// or remove the assignment entirely if result is not needed
await someFunction()
```

**Error type 4 — Unnecessary conditional (import/page.tsx line 236)**

Read the actual code at that line and fix it. The linter says `value is always truthy` —
remove the condition that is never false.

### Proof required

After fixing, run:
```
pnpm lint src/app/\(dashboard\)/import/page.tsx src/app/\(dashboard\)/contacts/page.tsx src/app/\(dashboard\)/contacts/new/page.tsx
```

Paste the **full output**. It must show 0 errors and 0 warnings for these files.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 2 — Fix the non-null assertion warnings

### What you must do

Read these files:
- `src/components/forms/InvoiceForm.tsx` (line 52)
- `src/components/charts/ExpenseTreemap.tsx` (line 39)
- `src/components/charts/CashFlowWaterfall.tsx` (line 51)
- `src/components/cfo/CFOResultChart.tsx` (lines 32, 71, 107)
- `src/components/cfo/CFOChatSession.tsx` (lines 61, 80, 86)
- `src/app/reports/bilanco/pdf/[periodId]/page.tsx` (line 57)

For each non-null assertion (`!`), fix it properly:

```typescript
// WRONG — crashes if value is null/undefined
const value = someObject!.property

// CORRECT option A — null check
if (!someObject) return null
const value = someObject.property

// CORRECT option B — nullish coalescing with sensible default
const value = someObject?.property ?? defaultValue

// CORRECT option C — Zod/type guard ensuring value exists before this point
// (if the type system guarantees non-null at this point, use a type assertion
//  with a comment explaining why, not a bare !)
const value = (someObject as NonNullable<typeof someObject>).property
// But prefer option A or B over this
```

### Proof required

After fixing, run:
```
pnpm lint src/components/forms/InvoiceForm.tsx src/components/charts/ src/components/cfo/ src/app/reports/
```

Paste the full output. Must show 0 errors and 0 warnings for these files.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 3 — Fix the node:crypto build error

### What you must do

Run `pnpm build` locally. Find the exact error. It says something imports `node:crypto`
in a way Next.js cannot bundle.

The most common cause is a server-only module being imported in a client component,
or a module that uses Node built-ins being bundled for the browser.

**Diagnosis steps:**
1. Run `pnpm build 2>&1 | grep -A 5 'crypto'` — paste the full error
2. The error will show which file is causing it
3. Read that file

**Common fixes:**

If the import is in a file that runs on both client and server, move it to a server-only file:
```typescript
// Add at the top of the file to enforce server-only
import 'server-only'
```

If the module uses `node:crypto` and is only needed server-side, add it to the
`serverExternalPackages` in `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['<the-package-name>'],
}
```

If it is one of the Trigger.dev job files being incorrectly imported in a client path,
ensure no client component imports from `src/server/jobs/`.

### Proof required

After fixing, run `pnpm build`. Paste the last 20 lines of the output.
It must NOT contain any `node:crypto` error. The build must complete.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 4 — Restore CI to actually enforce quality

### What you must do

Read `.github/workflows/ci.yml` in full. Paste its current content here first.

Then fix the following problems:

**Problem A — Lint is non-blocking**

Find the lint step. If it has `continue-on-error: true`, remove that line.
The lint step must fail the CI run if there are any errors.

**Problem B — Build is set to continue-on-error**

Find the build step. If it has `continue-on-error: true`, remove that line.
The build must fail CI if it fails.

The correct CI file should look like this (no `continue-on-error` anywhere):

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check
        env:
          SKIP_ENV_VALIDATION: '1'

      - name: Lint
        run: pnpm lint src/
        env:
          SKIP_ENV_VALIDATION: '1'

      - name: Unit tests
        run: pnpm test
        env:
          SKIP_ENV_VALIDATION: '1'

      - name: Build
        run: pnpm build
        env:
          SKIP_ENV_VALIDATION: '1'
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder'
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder'
```

### Proof required

After saving the file, paste its **complete content**.
Confirm: does it contain the word `continue-on-error` anywhere? It must not.
Confirm: does it contain `non-blocking` or `--max-warnings 9999` or similar weakening? It must not.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 5 — Fix .env.example and README

### What you must do

**Part A — .env.example**

Read `.env.example` in full. Make these exact changes:

1. Remove this line:
```
CLERK_SUPABASE_JWT_TEMPLATE=supabase
```

2. After the `SUPABASE_DB_URL` line, add:
```bash
# Session pooler (port 5432) — used ONLY by drizzle-kit migrations, NOT by the app at runtime
# Get from: Supabase Dashboard → Connect button → Session pooler tab (port 5432)
SUPABASE_DB_URL_UNPOOLED=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Part B — README.md**

Read `README.md` in full. Make these exact changes:

1. Replace `npm install` with `pnpm install`
2. Replace `npm run dev` with `pnpm dev`  
3. In the environment variables table, remove the row for `CLERK_SUPABASE_JWT_TEMPLATE`
4. In the environment variables table, add after the `SUPABASE_DB_URL` row:
   `| SUPABASE_DB_URL_UNPOOLED | Supabase | ✅ (migrations only) |`
5. In the Supabase section at the bottom, remove the sentence about "Clerk + Supabase JWT template named supabase"
   and replace with: "Auth is handled via Clerk Third Party Auth configured in Supabase"

### Proof required

Paste the **complete content** of `.env.example` after changes.
Paste the **complete content** of `README.md` after changes.

Check: does either file contain `CLERK_SUPABASE_JWT_TEMPLATE`? Neither should.
Check: does `.env.example` contain `SUPABASE_DB_URL_UNPOOLED`? It must.
Check: does `README.md` contain `npm install`? It must not.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 6 — Fix drizzle.config.ts

### What you must do

Read `drizzle.config.ts` in full. Paste its current content.

Replace the entire file content with:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use the SESSION pooler (port 5432) for migrations.
    // The transaction pooler (port 6543) in SUPABASE_DB_URL breaks some DDL.
    // The app runtime Drizzle client correctly uses SUPABASE_DB_URL (transaction pooler).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    url: process.env.SUPABASE_DB_URL_UNPOOLED ?? process.env.SUPABASE_DB_URL!,
  },
  verbose: true,
  strict: true,
});
```

### Proof required

Paste the **complete content** of `drizzle.config.ts` after saving.

Check: does it contain `SUPABASE_DB_URL_UNPOOLED`? It must.
Check: does it still reference only `SUPABASE_DB_URL` without the fallback? It must not.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 7 — Fix Trigger.dev (the most important fix — do not skip)

This step has three parts. All three must be done.

### Part A — Create src/server/jobs/_env.ts

Create this file. It must not exist yet — check first.

```typescript
// src/server/jobs/_env.ts
//
// Lightweight env validator for Trigger.dev job processes.
//
// WHY THIS FILE EXISTS:
// Trigger.dev jobs run in a separate Node.js process, not in Next.js.
// @/env.ts uses @t3-oss/env-nextjs which requires the Next.js runtime
// and validates NEXT_PUBLIC_ variables against a browser context that
// does not exist in Trigger.dev. Importing @/env.ts from a job crashes
// the Trigger.dev process at startup.
//
// This file reads process.env directly with fail-fast validation.
// Import this in all job files instead of @/env.ts or @/server/db.

function get(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Trigger.dev job] Missing required environment variable: ${key}`);
  }
  return val;
}

export const jobEnv = {
  // Supabase (all jobs)
  SUPABASE_URL:              get('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_DB_URL:           get('SUPABASE_DB_URL'),
  // Cloudflare R2 (excel-import-large, report-generate)
  R2_ACCOUNT_ID:             get('CLOUDFLARE_R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID:          get('CLOUDFLARE_R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY:      get('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME:            get('CLOUDFLARE_R2_BUCKET_NAME'),
  // Email (billing-reminder-daily)
  RESEND_API_KEY:            get('RESEND_API_KEY'),
  // AI (report-generate, vanna jobs)
  GEMINI_API_KEY:            get('GEMINI_API_KEY'),
} as const;
```

**Proof for Part A:** Paste the complete content of `src/server/jobs/_env.ts`.

---

### Part B — Update all four excluded job files

Read each of these files in full before changing them:
- `src/server/jobs/billing-reminder-daily.ts`
- `src/server/jobs/duckdb-nightly-sync.ts`
- `src/server/jobs/excel-import-large.ts`
- `src/server/jobs/report-generate.ts`

For **each file**, do all of these:

1. Find the line(s) that import from `@/env` or `@/server/db` or any path that
   transitively imports from those. Remove those imports.

2. Add this import at the top of the file:
   ```typescript
   import { jobEnv } from './_env';
   ```

3. Replace every reference to the old env variables with `jobEnv` equivalents:
   - `env.NEXT_PUBLIC_SUPABASE_URL` → `jobEnv.SUPABASE_URL`
   - `env.SUPABASE_SERVICE_ROLE_KEY` → `jobEnv.SUPABASE_SERVICE_ROLE_KEY`
   - `env.SUPABASE_DB_URL` → `jobEnv.SUPABASE_DB_URL`
   - `env.RESEND_API_KEY` → `jobEnv.RESEND_API_KEY`
   - `env.GEMINI_API_KEY` → `jobEnv.GEMINI_API_KEY`
   - `env.CLOUDFLARE_R2_ACCOUNT_ID` → `jobEnv.R2_ACCOUNT_ID`
   - `env.CLOUDFLARE_R2_ACCESS_KEY_ID` → `jobEnv.R2_ACCESS_KEY_ID`
   - `env.CLOUDFLARE_R2_SECRET_ACCESS_KEY` → `jobEnv.R2_SECRET_ACCESS_KEY`
   - `env.CLOUDFLARE_R2_BUCKET_NAME` → `jobEnv.R2_BUCKET_NAME`

4. For any Supabase client created inside the job, use:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(jobEnv.SUPABASE_URL, jobEnv.SUPABASE_SERVICE_ROLE_KEY);
   ```

5. For the R2 / S3 client in `excel-import-large.ts`, use:
   ```typescript
   import { S3Client } from '@aws-sdk/client-s3';
   const s3 = new S3Client({
     region: 'auto',
     endpoint: `https://${jobEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: jobEnv.R2_ACCESS_KEY_ID,
       secretAccessKey: jobEnv.R2_SECRET_ACCESS_KEY,
     },
   });
   ```

**Proof for Part B:** For each of the four files, paste the first 30 lines showing
the new imports. Confirm that `@/env` and `@/server/db` no longer appear.

---

### Part C — Remove ignorePatterns from trigger.config.ts

Read `trigger.config.ts` in full. Paste its current content.

Delete the entire `ignorePatterns` array and its comment block (lines that say
"Exclude jobs that depend on @/server/db" and the array below it).

The final file must look like this:

```typescript
import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'proj_duakssiafwiyuuqoyras',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
    },
  },
  dirs: ['src/server/jobs'],
  build: {
    external: [
      'duckdb',
      '@duckdb/node-api',
      'playwright',
      'playwright-core',
      '@mapbox/node-pre-gyp',
      'nock',
      'mock-aws-s3',
      'aws-sdk',
    ],
  },
});
```

**Proof for Part C:** Paste the **complete content** of `trigger.config.ts`.

Check: does it contain `ignorePatterns`? It must not.
Check: does it contain `billing-reminder-daily`? It must not.
Check: does it contain `duckdb-nightly-sync`? It must not.

Write `STEP COMPLETE ✓` or `STEP FAILED — reason`.

---

## STEP 7 TYPE CHECK

After completing all three parts of Step 7, run:

```
pnpm tsc --noEmit 2>&1 | head -50
```

Paste the output. If there are TypeScript errors in any job file or in `_env.ts`,
fix them now. Do not proceed until `tsc --noEmit` exits 0.

---

## FINAL VERIFICATION — Run this after all 7 steps

Run each command. Paste the output. Do not skip any.

```bash
# 1. TypeScript
pnpm tsc --noEmit
# Expected: exits 0, no output

# 2. Lint (src/ only — tests have separate config)
pnpm lint src/
# Expected: exits 0, "0 problems" or no output

# 3. Tests
pnpm test
# Expected: exits 0, all tests pass

# 4. Build
pnpm build
# Expected: exits 0, no node:crypto errors, no module errors
```

Then check these files exist and have the right content:

```bash
# _env.ts must exist
cat src/server/jobs/_env.ts | head -5
# Expected: shows the file starting with "// src/server/jobs/_env.ts"

# trigger.config.ts must not have ignorePatterns
grep -c 'ignorePatterns' trigger.config.ts
# Expected: 0

# drizzle.config.ts must have unpooled URL
grep 'SUPABASE_DB_URL_UNPOOLED' drizzle.config.ts
# Expected: shows the line with the fallback

# .env.example must not have deprecated var
grep -c 'CLERK_SUPABASE_JWT_TEMPLATE' .env.example
# Expected: 0

# .env.example must have new var
grep 'SUPABASE_DB_URL_UNPOOLED' .env.example
# Expected: shows the line

# README must use pnpm
grep -c 'npm install' README.md
# Expected: 0

# CI must not have continue-on-error
grep -c 'continue-on-error' .github/workflows/ci.yml
# Expected: 0
```

Paste every output. Then commit:

```bash
git add -A
git commit -m "fix: resolve all audit issues — jobs env, drizzle url, clerk cleanup, ci quality, lint errors"
git push
```

After pushing, paste the GitHub Actions URL for the new CI run.
Wait for it to complete. Paste whether it passed or failed.

**If CI fails after your push:** that means one of the fixes above was not actually done correctly.
Do not make the failing step non-blocking. Fix the actual problem.

---

## IF YOU GET STUCK

If you cannot fix something, write exactly this:

```
BLOCKED on [step name]: [exact reason you cannot fix it]
```

Then stop. Do not pretend the step is done. Do not move to the next step.
Honestly reporting a blocker is more useful than falsely reporting success.

---

*All 7 steps must produce passing proof before this session is considered complete.*
