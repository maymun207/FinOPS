# FinOPS Audit Fix Prompt
## AntiGravity + Opus 4.6 Extended Thinking — Single Session

> **Instructions for AntiGravity:** You are working on the FinOPS platform repository. This file contains 8 sequential fixes identified by an external audit. Read the entire file first, then execute each fix in order. Do not reorder steps. Report the result of every verification check explicitly in your response.

---

## Context

You are working on the FinOPS platform at `github.com/maymun207/FinOPS`. This is a Next.js 15 + tRPC + Drizzle + Supabase + Clerk + Trigger.dev financial operations platform for Turkish SMEs. An external audit has identified 7 confirmed issues and 5 items requiring verification. 

**Non-negotiable rules throughout this session:**
1. Read the specified files before writing any code for that fix.
2. Apply the exact code patterns shown — do not improvise alternatives unless explicitly told to.
3. Run the verification check at the end of each fix before moving to the next.
4. Never use JavaScript native arithmetic (`+`, `-`, `*`, `/`) on monetary values — always use `decimal.js`.
5. Report the result of every verification check in your response.

---

## FIX 1 — CRITICAL: Refactor 4 Excluded Trigger.dev Jobs

### Context

The `trigger.config.ts` file's `ignorePatterns` block excludes 4 of the 7 jobs:
- `billing-reminder-daily`
- `duckdb-nightly-sync`
- `excel-import-large`
- `report-generate`

These jobs are excluded because they import from `@/env.ts` which uses `@t3-oss/env-nextjs`. This package requires the Next.js runtime environment — it validates `NEXT_PUBLIC_` variables against a browser context that does not exist in Trigger.dev's job runner process.

The fix is to give each excluded job its own lightweight env validator that reads from `process.env` directly, bypassing t3-env entirely. Trigger.dev jobs are separate processes and must be self-contained.

---

### Step 1.1 — Create the Trigger.dev env helper

Create the file `src/server/jobs/_env.ts` with this exact content:

```typescript
// src/server/jobs/_env.ts
// Lightweight env validator for Trigger.dev job context.
// NEVER import @/env.ts from jobs — it requires Next.js runtime.
// This file uses process.env directly with fail-fast validation.

function get(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Trigger.dev] Missing required env var: ${key}`);
  }
  return val;
}

export const jobEnv = {
  // Supabase (used by all jobs)
  SUPABASE_URL:              get('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_DB_URL:           get('SUPABASE_DB_URL'),
  // Cloudflare R2 (used by excel-import-large, report-generate)
  R2_ACCOUNT_ID:             get('CLOUDFLARE_R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID:          get('CLOUDFLARE_R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY:      get('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME:            get('CLOUDFLARE_R2_BUCKET_NAME'),
  // Email (used by billing-reminder-daily)
  RESEND_API_KEY:            get('RESEND_API_KEY'),
  // AI (used by report-generate)
  GEMINI_API_KEY:            get('GEMINI_API_KEY'),
} as const;
```

---

### Step 1.2 — Update each excluded job file

For each of the four excluded jobs, find the line that imports from `@/env.ts` or `@/server/db` (which transitively imports env.ts) and replace it with the `jobEnv` import. Then update all env variable references throughout the file.

**billing-reminder-daily.ts:**
- Remove: any import of env from `@/env.ts`
- Add at top: `import { jobEnv } from './_env'`
- Replace all `env.RESEND_API_KEY` with `jobEnv.RESEND_API_KEY`
- Replace all `env.NEXT_PUBLIC_SUPABASE_URL` with `jobEnv.SUPABASE_URL`
- Replace all `env.SUPABASE_SERVICE_ROLE_KEY` with `jobEnv.SUPABASE_SERVICE_ROLE_KEY`
- Construct Supabase client using: `createClient(jobEnv.SUPABASE_URL, jobEnv.SUPABASE_SERVICE_ROLE_KEY)`

**duckdb-nightly-sync.ts:**
- Remove: any import of env from `@/env.ts`
- Add at top: `import { jobEnv } from './_env'`
- Replace all env variable references with `jobEnv` equivalents
- The PostgreSQL connection string for DuckDB must use `jobEnv.SUPABASE_DB_URL`

**excel-import-large.ts:**
- Remove: any import of env from `@/env.ts`
- Add at top: `import { jobEnv } from './_env'`
- Construct S3Client for R2 with:

```typescript
new S3Client({
  region: 'auto',
  endpoint: `https://${jobEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: jobEnv.R2_ACCESS_KEY_ID,
    secretAccessKey: jobEnv.R2_SECRET_ACCESS_KEY,
  },
})
```

**report-generate.ts:**
- Remove: any import of env from `@/env.ts`
- Add at top: `import { jobEnv } from './_env'`
- Replace all env variable references with `jobEnv` equivalents

---

### Step 1.3 — Remove the ignorePatterns block from trigger.config.ts

Open `trigger.config.ts`. Delete the entire `ignorePatterns` array and its comment block. The result should look like this:

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
  // ignorePatterns removed — jobs now use _env.ts instead of @/env.ts
  build: {
    external: [
      'duckdb', '@duckdb/node-api', 'playwright', 'playwright-core',
      '@mapbox/node-pre-gyp', 'nock', 'mock-aws-s3', 'aws-sdk',
    ],
  },
});
```

---

### ⚠️ Pitfalls for Fix 1

- **PITFALL 1:** The `_env.ts` file throws immediately at module load time if a variable is missing. If a variable is absent from `.env`, the job runner process crashes on startup. This is correct and intentional.
- **PITFALL 2:** Do NOT import `@/server/db/client.ts` from any job file. The Drizzle client imports from `@/env.ts` transitively. Jobs needing database access must construct their own `pg.Pool` or Supabase client using `jobEnv` variables directly.
- **PITFALL 3:** Cron jobs do not run automatically with `npx trigger dev` — trigger them manually from the Trigger.dev dashboard during testing.

---

### ✅ Verification Gate — Fix 1

Run each check and report the result:

1. `pnpm tsc --noEmit` — must exit 0 with no errors in `_env.ts` or any job file
2. `npx trigger dev` — all 7 job files must appear in the console as registered tasks with no "ignoring" messages
3. In the Trigger.dev cloud dashboard, verify all 7 tasks appear: `billing-reminder-daily`, `duckdb-nightly-sync`, `excel-import-large`, `report-generate`, `vanna-inference`, `vanna-training-update`, `audit-anomaly-digest`

**Do not proceed to Fix 2 until all 3 checks pass.**

---

## FIX 2 — CRITICAL: Fix Drizzle Migration URL

### Context

`drizzle.config.ts` uses `SUPABASE_DB_URL` which points to Supabase's transaction pooler (port 6543). Drizzle-kit migrations require a persistent session connection and will fail or behave incorrectly on the transaction pooler. The runtime Drizzle client correctly uses the transaction pooler. Only `drizzle.config.ts` needs changing.

---

### Step 2.1 — Add SUPABASE_DB_URL_UNPOOLED to .env.example

Open `.env.example`. After the `SUPABASE_DB_URL` line, add:

```bash
# Session pooler (port 5432) — used ONLY by drizzle-kit migrations
# Get from Supabase dashboard → Connect button → Session pooler tab
SUPABASE_DB_URL_UNPOOLED=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

Also add this variable to your actual `.env` file with your real session pooler URL from Supabase.

---

### Step 2.2 — Update drizzle.config.ts

Replace the current `drizzle.config.ts` content with:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use the SESSION pooler (port 5432) for migrations.
    // The transaction pooler (port 6543) breaks some DDL operations.
    // Runtime Drizzle client uses SUPABASE_DB_URL (transaction pooler) — that is correct.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    url: process.env.SUPABASE_DB_URL_UNPOOLED ?? process.env.SUPABASE_DB_URL!,
  },
  verbose: true,
  strict: true,
});
```

---

### Step 2.3 — Add SUPABASE_DB_URL_UNPOOLED to src/env.ts

Open `src/env.ts`. In the server schema section, add:

```typescript
SUPABASE_DB_URL_UNPOOLED: z.string().url().optional(),
```

This is optional — it only needs to exist when running migrations, not during app runtime.

---

### ⚠️ Pitfalls for Fix 2

- **PITFALL:** Get the session pooler URL from Supabase dashboard → Connect button → look for the row with port 5432 (Session pooler). This is different from the Transaction pooler URL (port 6543) already in your `SUPABASE_DB_URL`.
- **PITFALL:** Never use the Direct connection string for migrations on Vercel or other IPv4-only environments — Supabase direct connections are IPv6-only by default. Always use the session pooler.

---

### ✅ Verification Gate — Fix 2

1. `pnpm drizzle-kit generate` — must complete without connection errors
2. `pnpm drizzle-kit migrate` — must apply all migrations successfully
3. Verify the migration ran correctly by checking Supabase → Table Editor for your tables

**Do not proceed to Fix 3 until all checks pass.**

---

## FIX 3 — CRITICAL: Audit and Fix Clerk–Supabase Integration

### Context

As of April 2025, the Clerk–Supabase integration changed fundamentally. The old approach used a shared JWT secret: Clerk minted tokens signed with the Supabase JWT secret, requiring `CLERK_SUPABASE_JWT_TEMPLATE` and calling `getToken({ template: 'supabase' })`. The new approach uses Clerk as a third-party auth provider configured in Supabase (Authentication → Third Party Auth → Clerk), verifying JWTs via Clerk's public JWKS endpoint — no shared secret, no template name.

The `CLERK_SUPABASE_JWT_TEMPLATE` variable still appears in `.env.example` and `README.md`. If it also appears in code calling `getToken({ template: 'supabase' })`, the integration is on the deprecated path.

---

### Step 3.1 — Search the entire codebase for deprecated patterns

Search for ALL occurrences of these strings and list every file where they appear:
- `getToken({ template:`
- `CLERK_SUPABASE_JWT_TEMPLATE`
- `template: 'supabase'`
- `template: "supabase"`

---

### Step 3.2 — Fix Supabase client creation wherever found

The new pattern for creating an authenticated Supabase client:

```typescript
// Browser-side (e.g. src/lib/supabase/client.ts)
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/nextjs';

export function useSupabaseClient() {
  const { getToken } = useAuth();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          // No template name — Clerk native session token works directly
          const token = await getToken();
          const headers = new Headers(options.headers);
          if (token) headers.set('Authorization', `Bearer ${token}`);
          return fetch(url, { ...options, headers });
        },
      },
    }
  );
}
```

```typescript
// Server-side (e.g. tRPC context, API routes)
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export async function createServerSupabaseClient() {
  const { getToken } = await auth();
  // No template parameter — Clerk sends its native JWT which Supabase
  // now verifies via the JWKS endpoint configured in Third Party Auth
  const token = await getToken();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
```

---

### Step 3.3 — Verify Supabase Third Party Auth is configured

Check the following is already configured in Supabase. If not, configure it now:

1. Supabase dashboard → Authentication → Sign In / Sign Up → Third Party Auth
2. Verify Clerk appears as a provider with your Clerk domain
3. If Clerk is NOT there: Add Provider → Clerk → enter your Clerk Frontend API domain (e.g. `your-app.clerk.accounts.dev`) → Save
4. In Clerk dashboard → Integrations → verify Supabase is Enabled (this adds `role: 'authenticated'` to Clerk JWTs automatically)

---

### Step 3.4 — Clean up deprecated env references

- Remove `CLERK_SUPABASE_JWT_TEMPLATE` from `.env.example`
- Remove `CLERK_SUPABASE_JWT_TEMPLATE` from `README.md` env table
- Remove `CLERK_SUPABASE_JWT_TEMPLATE` from `src/env.ts` if present

---

### ⚠️ Pitfalls for Fix 3

- **PITFALL:** If the code was already using `getToken()` without a template name AND Clerk Third Party Auth is already configured in Supabase, this fix is purely cleanup — do not introduce the new pattern again if it's already there.
- **PITFALL:** After switching to the new integration, `auth.uid()` in RLS policies will NOT work — it returns UUIDs and Clerk uses string IDs. Use `auth.jwt() ->> 'sub'` instead. This is covered in Fix 5.
- **PITFALL:** The `role` claim in the JWT must be exactly `'authenticated'` (lowercase) for Supabase RLS to recognise the user. The Clerk Supabase integration adds this automatically when enabled.

---

### ✅ Verification Gate — Fix 3

1. `grep -r 'getToken.*template' src/` — must return 0 results
2. `grep -r 'CLERK_SUPABASE_JWT_TEMPLATE' src/` — must return 0 results
3. Manual test: sign in with a Clerk account, make one authenticated tRPC query — must return data without a 401 error

**Do not proceed to Fix 4 until all checks pass.**

---

## FIX 4 — VERIFY: Database Triggers

### Context

The balance trigger on `journal_entry_lines` must be `DEFERRABLE INITIALLY DEFERRED`. Without this, inserting the first line of a journal entry always fails because the trigger fires after the first INSERT and sees only one line (debit ≠ credit). `DEFERRABLE` means the trigger fires at commit time, after all lines exist.

The fiscal period lock trigger must be `BEFORE INSERT OR UPDATE`. This fires synchronously before the row is written, allowing it to `RAISE EXCEPTION` which aborts the write.

---

### Step 4.1 — Read the trigger migration file

Read `supabase/migrations/0003_triggers.sql` completely. Check each pattern:

**Check A — Balance trigger must be `DEFERRABLE INITIALLY DEFERRED`:**

```sql
-- CORRECT
CREATE CONSTRAINT TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- WRONG — missing DEFERRABLE, breaks all journal entry creation
CREATE TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();
```

**Check B — Balance function must SUM all lines for the entry:**

```sql
-- CORRECT
SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
INTO v_debit, v_credit
FROM journal_entry_lines WHERE journal_entry_id = NEW.journal_entry_id;

-- WRONG — only looks at the current row
IF NEW.debit_amount <> NEW.credit_amount THEN RAISE EXCEPTION ...
```

**Check C — Fiscal lock must be `BEFORE INSERT OR UPDATE`:**

```sql
-- CORRECT
CREATE TRIGGER trg_fiscal_period_lock
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION check_fiscal_period_open();

-- WRONG — AFTER fires after the row is written, too late to stop it
CREATE TRIGGER trg_fiscal_period_lock
  AFTER INSERT OR UPDATE ON journal_entries ...
```

---

### Step 4.2 — Fix if any check failed

If any check shows the wrong pattern, update `0003_triggers.sql`. Then to apply to the live database (since migrations already ran), run in Supabase SQL Editor:

```sql
-- Drop and recreate the balance trigger with correct DEFERRABLE clause
DROP TRIGGER IF EXISTS trg_journal_balance ON journal_entry_lines;
DROP FUNCTION IF EXISTS check_journal_balance();

CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE v_debit NUMERIC; v_credit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
  INTO v_debit, v_credit
  FROM journal_entry_lines WHERE journal_entry_id = NEW.journal_entry_id;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debit=% credit=%',
      NEW.journal_entry_id, v_debit, v_credit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();
```

---

### ✅ Verification Gate — Fix 4

Run in Supabase SQL Editor and report the results:

```sql
SELECT trigger_name, event_manipulation, action_timing, is_deferrable, initially_deferred
FROM information_schema.triggers
WHERE trigger_name IN ('trg_journal_balance', 'trg_fiscal_period_lock')
ORDER BY trigger_name;
```

Expected:
- `trg_journal_balance`: `is_deferrable=YES`, `initially_deferred=YES`, `action_timing=AFTER`
- `trg_fiscal_period_lock`: `is_deferrable=NO`, `action_timing=BEFORE`

Also run these functional tests in SQL Editor:

```sql
-- Test 1: Balanced entry should succeed
BEGIN;
INSERT INTO journal_entries (id, company_id, fiscal_period_id, entry_date, description, entry_type)
VALUES (gen_random_uuid(), '<your_company_id>', '<open_period_id>', CURRENT_DATE, 'Test', 'ADJUSTMENT');
-- Insert balanced lines (debit = credit = 1000)
INSERT INTO journal_entry_lines (id, journal_entry_id, company_id, account_code_id, debit_amount, credit_amount)
VALUES (gen_random_uuid(), '<entry_id>', '<company_id>', '<account_id>', 1000.00, 0.00);
INSERT INTO journal_entry_lines (id, journal_entry_id, company_id, account_code_id, debit_amount, credit_amount)
VALUES (gen_random_uuid(), '<entry_id>', '<company_id>', '<account_id_2>', 0.00, 1000.00);
COMMIT; -- Must succeed

-- Test 2: Unbalanced entry should fail at commit
BEGIN;
-- Insert same entry_id but only one unbalanced line
-- COMMIT; -- Must throw: 'unbalanced'
ROLLBACK;
```

**Do not proceed to Fix 5 until verification passes.**

---

## FIX 5 — VERIFY: RLS Policies — JWT Claim Path

### Context

With Clerk Third Party Auth, `auth.uid()` returns a UUID but Clerk user IDs are strings (e.g. `user_2abc123`). Any RLS policy using `auth.uid()` silently returns empty results for all Clerk users. All policies must use `auth.jwt() ->> 'sub'` for user identity and `auth.jwt() ->> 'org_id'` for company isolation.

---

### Step 5.1 — Read the RLS migration file

Read `supabase/migrations/0004_rls.sql` completely. Search for all occurrences of:
- `auth.uid()`
- `auth.role()`

---

### Step 5.2 — Fix all auth.uid() references

```sql
-- WRONG (auth.uid() returns UUID, Clerk IDs are strings — silent empty results)
USING (user_id = auth.uid())

-- CORRECT for user-scoped data
USING ((auth.jwt() ->> 'sub') = user_id::text)

-- CORRECT for company-scoped data (the main pattern throughout this app)
USING (
  company_id = (
    SELECT id FROM companies
    WHERE clerk_org_id = (auth.jwt() ->> 'org_id')
    LIMIT 1
  )
)
```

---

### Step 5.3 — Fix requesting_user_id() if it exists

```sql
-- WRONG
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS TEXT AS $$
  SELECT auth.uid()::text;
$$ LANGUAGE SQL STABLE;

-- CORRECT
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS TEXT AS $$
  SELECT auth.jwt() ->> 'sub';
$$ LANGUAGE SQL STABLE;
```

---

### Step 5.4 — Apply fixed RLS policies to the database

For each policy you changed, run in Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS <policy_name> ON <table_name>;
-- Then paste the corrected CREATE POLICY statement
```

Also add an index if not already present:

```sql
CREATE INDEX IF NOT EXISTS idx_companies_clerk_org_id ON companies(clerk_org_id);
```

---

### ⚠️ Pitfalls for Fix 5

- **PITFALL:** `auth.jwt()` returns `NULL` if no token is present. The `->>` operator on NULL returns NULL. NULL = anything is NULL (falsy). Unauthenticated requests correctly get 0 rows — this is correct.
- **PITFALL:** Add `LIMIT 1` to the companies subquery in RLS policies. Without it, if the `UNIQUE` constraint ever fails and multiple rows match, the comparison breaks.

---

### ✅ Verification Gate — Fix 5

```sql
SELECT polname, pg_get_expr(polqual, polrelid) as using_clause
FROM pg_policy
WHERE polrelid = 'invoices'::regclass;
```

The `using_clause` must contain `auth.jwt()` and must NOT contain `auth.uid()`.

Manual cross-company isolation test:
1. Log in as User A (Org A) → create an invoice
2. Log in as User B (Org B) → query invoices → result must be empty

**Do not proceed to Fix 6 until verification passes.**

---

## FIX 6 — VERIFY: tRPC Context — Company ID Resolution

### Context

Every protected tRPC procedure must resolve `company_id` from the Clerk session and attach it to `ctx`. Without this, routers have no way to scope queries to the correct company.

---

### Step 6.1 — Read the tRPC files

Read these files:
- `src/server/trpc/trpc.ts`
- `src/server/trpc/context.ts` (if it exists as a separate file)

---

### Step 6.2 — Verify and fix if necessary

The `protectedProcedure` must resolve `companyId` via a Supabase lookup. If it does not, apply this pattern:

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@clerk/nextjs/server';
import superjson from 'superjson';

type Context = {
  userId: string | null;
  orgId: string | null;
  companyId: string | null;
};

export async function createTRPCContext(): Promise<Context> {
  const { userId, orgId } = await auth();
  return { userId, orgId, companyId: null };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

const resolveCompany = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Use service role client for the company lookup — this is a trusted internal lookup
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('clerk_org_id', ctx.orgId)
    .single();

  if (!company) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No company found for this Clerk organization.',
    });
  }

  return next({ ctx: { ...ctx, companyId: company.id } });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(resolveCompany);
```

---

### ⚠️ Pitfalls for Fix 6

- **PITFALL:** `ctx.companyId` must be typed as `string` (not `string | null`) inside protected procedure handlers. TypeScript should enforce this because `resolveCompany` throws before `next()` if no company is found. Verify the types are correct with `pnpm tsc --noEmit`.
- **PITFALL:** If latency becomes a concern, add caching for the `orgId → companyId` lookup with a 5-minute TTL using Upstash Redis. For now the direct Supabase query is acceptable.

---

### ✅ Verification Gate — Fix 6

1. `pnpm tsc --noEmit` — must exit 0. Inside any `protectedProcedure` handler, `ctx.companyId` must be typed as `string` (not `string | null`)
2. Manual test: call a protected tRPC procedure with a valid Clerk session → must return data, not FORBIDDEN
3. Manual test: call a protected tRPC procedure with no Clerk session → must return UNAUTHORIZED
4. Manual test: call a protected tRPC procedure with a Clerk session for a user whose org has no corresponding `companies` row → must return FORBIDDEN with 'No company found' message

**Do not proceed to Fix 7 until all checks pass.**

---

## FIX 7 — VERIFY: Invoice Router — decimal.js + Transaction Atomicity

### Context

Two correctness requirements for invoice creation:

1. All KDV and monetary calculations must use `decimal.js`, not JavaScript native arithmetic. Drizzle returns decimal database columns as strings. Adding strings with `+` gives concatenation. Multiplying with `*` gives floating-point errors.

2. The entire invoice creation — header, line items, journal entry, journal entry lines — must happen inside a single Drizzle transaction using `db.transaction(async (tx) => { ... })`. Using `db` instead of `tx` for any step breaks atomicity.

---

### Step 7.1 — Read the invoice router

Read `src/server/trpc/routers/invoices.ts` completely.

---

### Step 7.2 — Audit for native arithmetic on monetary values

Search for these dangerous patterns. Each one is a bug:

```typescript
// BUG — string concatenation, not addition
subtotal + kdv_amount
subtotal + kdvAmount
total + amount

// BUG — floating-point multiplication
quantity * unit_price
subtotal * kdv_rate / 100

// BUG — still floating-point even with parseFloat
parseFloat(x) + parseFloat(y)

// CORRECT — all monetary arithmetic through decimal.js
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const subtotal = new Decimal(quantity).times(unit_price).toDecimalPlaces(2);
const kdvAmount = subtotal.times(kdv_rate).dividedBy(100).toDecimalPlaces(2);
const total = subtotal.plus(kdvAmount);

// When saving to Drizzle — use .toFixed(2) to produce the string Drizzle expects
// e.g. subtotal: subtotal.toFixed(2),
```

---

### Step 7.3 — Audit for transaction atomicity

```typescript
// CORRECT — all operations use tx, not db
const result = await db.transaction(async (tx) => {
  const [invoice] = await tx.insert(invoices).values({ ... }).returning();
  await tx.insert(invoiceLineItems).values(lineItemRows);
  const [entry] = await tx.insert(journalEntries).values({ ... }).returning();
  await tx.insert(journalEntryLines).values(journalLineRows);
  return invoice;
});

// WRONG — using db instead of tx inside the transaction (escapes atomicity)
await db.transaction(async (tx) => {
  const [invoice] = await tx.insert(invoices)...;
  await db.insert(invoiceLineItems)...;  // BUG: this is db, not tx
});
```

---

### Step 7.4 — Apply fixes if any were found

Replace every instance of native arithmetic with the `decimal.js` equivalent. Replace every `db` used inside a transaction with `tx`.

---

### ⚠️ Pitfalls for Fix 7

- **PITFALL:** Drizzle decimal columns return `string` in TypeScript. You cannot do `new Decimal(undefined)` — always check that the value is non-null before passing to `Decimal()`. If a value might be null, use `new Decimal(value ?? '0')`.
- **PITFALL:** `toDecimalPlaces(2)` rounds to 2 decimal places but returns a `Decimal` object. Use `.toFixed(2)` to get the string for database insertion. Use `.toNumber()` only for display purposes, never for further arithmetic.

---

### ✅ Verification Gate — Fix 7

1. `pnpm test -- --testPathPattern=kdv` — must pass including: `qty:3 price:333.33 rate:10` → `subtotal:999.99 kdv:100.00 total:1099.99`
2. `pnpm test -- --testPathPattern=invoices` — integration tests must pass
3. `grep -rn 'parseFloat\|[0-9] \* \|[0-9] \+ \|[0-9] \- ' src/server/trpc/routers/invoices.ts` — must return 0 results
4. Manual test: create a PURCHASE invoice with 2 line items (%20 and %10 KDV) in the browser. In Supabase → Table Editor verify:
   - 1 invoice row
   - 2 invoice_line_items rows
   - 1 journal_entry row
   - 3 journal_entry_lines rows (expense, KDV, vendor/payable)
   - `SUM(debit_amount) = SUM(credit_amount)` for that journal entry

**Do not proceed to Fix 8 until all checks pass.**

---

## FIX 8 — POLISH: CI/CD Pipeline + README Cleanup

### Step 8.1 — Create .github/workflows/ci.yml

Create the directory `.github/workflows/` at the repo root and create `ci.yml`:

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
        run: pnpm lint
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

---

### Step 8.2 — Fix README npm → pnpm

Open `README.md`. Replace all npm commands with pnpm equivalents:
- `npm install` → `pnpm install`
- `npm run dev` → `pnpm dev`
- `npm run build` → `pnpm build`
- `npm run test` → `pnpm test`

---

### Step 8.3 — Add SUPABASE_DB_URL_UNPOOLED to README env table

In the README environment variables table, add a row after `SUPABASE_DB_URL`:

| `SUPABASE_DB_URL_UNPOOLED` | Supabase | ✅ (migrations only) |

---

### ✅ Verification Gate — Fix 8

1. Commit and push `ci.yml`. In GitHub → Actions tab, verify the CI workflow runs and passes
2. `grep -r 'npm ' README.md` — must return 0 results

---

## FINAL END-TO-END VERIFICATION

After all 8 fixes are complete, run this full verification sequence and report the result of every check:

### Automated checks

```bash
pnpm type-check      # must exit 0
pnpm lint            # must exit 0
pnpm test            # must exit 0, all unit tests passing
pnpm build           # must exit 0, no build errors
npx trigger dev      # all 7 tasks must appear as registered
```

### Database state checks (run in Supabase SQL Editor)

```sql
-- Check 1: Trigger configuration
SELECT trigger_name, is_deferrable, initially_deferred, action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('trg_journal_balance', 'trg_fiscal_period_lock')
ORDER BY trigger_name;
-- Expected: balance=DEFERRABLE/YES/AFTER, fiscal=NO/NO/BEFORE

-- Check 2: RLS is enabled
SELECT schemaname, tablename
FROM pg_tables
WHERE rowsecurity = true AND schemaname = 'public';
-- Expected: at least 9 tables

-- Check 3: No auth.uid() in invoice RLS policies
SELECT polname, pg_get_expr(polqual, polrelid)
FROM pg_policy
WHERE polrelid = 'invoices'::regclass;
-- Expected: using_clause contains auth.jwt(), NOT auth.uid()

-- Check 4: TDHP seed data
SELECT COUNT(*) FROM chart_of_accounts WHERE company_id IS NULL;
-- Expected: >= 150
```

### Manual flow test

1. Sign in with a Clerk account belonging to an organization
2. Create a new contact (vendor)
3. Create a PURCHASE invoice with 2 line items: one at KDV %20, one at KDV %10
4. Submit — verify no error, invoice appears with status UNPAID
5. In Supabase → Table Editor verify:
   - 1 invoice row
   - 2 invoice_line_items rows
   - 1 journal_entry row
   - ≥3 journal_entry_lines rows
   - `SUM(debit_amount) = SUM(credit_amount)` for that journal entry
6. Record a full payment → verify invoice status → PAID
7. Verify 2 additional journal_entry_lines for the payment entry

### Trigger.dev checks

1. In Trigger.dev cloud dashboard — verify 7 tasks registered (not 3 as before)
2. Manually trigger `billing-reminder-daily` → must run without a 'missing env var' crash
3. Manually trigger `duckdb-nightly-sync` → must run and log sync progress

### Final gate

All automated checks exit 0. All database checks return expected results. Manual invoice flow creates balanced journal entries. Trigger.dev shows 7 registered tasks. Billing reminder runs without crashing.

```bash
git add -A
git commit -m "fix: resolve all audit issues — Trigger.dev jobs, drizzle config, Clerk integration, RLS, triggers"
git tag v1.0.1
git push && git push --tags
```

---

*Execute all fixes in order. Never skip a section. If a verification gate fails, fix the issue before proceeding. Report the result of every verification check in your response.*
