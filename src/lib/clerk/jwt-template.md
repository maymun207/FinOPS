# Clerk JWT Template Configuration — Supabase Integration

This document describes the manual step required to connect Clerk authentication with Supabase Row Level Security (RLS).

## Step 1: Create JWT Template in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → **JWT Templates**
2. Click **New template** → select **Supabase**
3. Set the template name to `supabase`
4. Configure the **Claims** payload:

```json
{
  "org_id": "{{org.id}}",
  "sub": "{{user.id}}",
  "role": "authenticated"
}
```

### Why these claims?

| Claim | Purpose |
|---|---|
| `org_id` | Maps to `companies.clerk_org_id` for tenant isolation via `public.get_company_id()` |
| `sub` | Standard JWT subject — the Clerk user ID, used by `public.get_user_id()` |
| `role` | Supabase uses this to apply RLS policies to the `authenticated` role |

## Step 2: Set the Signing Key

1. In the JWT template editor, find the **Signing key** section
2. Set the signing algorithm to **HS256**
3. Paste your **Supabase JWT Secret** as the signing key
   - Found in Supabase Dashboard → Settings → API → JWT Settings → JWT Secret
   - This is the `SUPABASE_JWT_SECRET` value

> [!IMPORTANT]
> The signing key must match the Supabase JWT secret exactly. If they don't match,
> Supabase will reject all tokens and RLS policies will fail with `permission denied`.

## Step 3: Verify

After saving the template:

1. Go to Clerk Dashboard → **Users** → select a test user
2. Click **Sessions** → **JWT Templates** → `supabase`
3. Copy the generated token
4. Decode it at [jwt.io](https://jwt.io) to verify the claims
5. Test it against Supabase by setting the token in the `Authorization` header

```bash
curl -H "Authorization: Bearer <clerk-jwt>" \
     -H "apikey: <supabase-anon-key>" \
     https://<project>.supabase.co/rest/v1/companies
```

## Architecture

```
Clerk Auth → JWT (supabase template) → Supabase PostgREST
                                        ↓
                                  request.jwt.claims
                                        ↓
                              get_company_id() / get_user_id()
                                        ↓
                                   RLS Policies
```

The Drizzle client (`src/server/db/client.ts`) connects via service_role (bypasses RLS).
tRPC routers enforce authorization at the application layer via `companyProcedure` middleware.
