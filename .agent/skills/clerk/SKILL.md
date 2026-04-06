---
name: clerk
description: Living knowledge base for Clerk authentication in FinOPS — a B2B SaaS platform built on Next.js 15 / tRPC / Supabase / Drizzle. Covers auth hooks, organization management, RBAC, server-side patterns, Supabase JWT integration, and webhooks. Use this skill when implementing auth, protecting routes, managing orgs/roles, or integrating Clerk with Supabase RLS.
---

# Clerk Authentication Skill (FinOPS)

This skill provides comprehensive guidance for **Clerk v7+** in the context of the FinOPS B2B SaaS platform (Next.js 15 App Router + tRPC + Supabase + Drizzle).

> [!IMPORTANT]
> FinOPS is a **pure B2B** app. Every authenticated user **must** belong to an organization (`orgId`). Personal accounts are not supported — always enforce org selection.

> [!NOTE]
> Use the Clerk MCP tool `mcp_clerk_clerk_sdk_snippet` to fetch the latest live code snippets at any time. Pass a slug like `b2b-saas`, `server-auth-nextjs`, `use-auth`, `organizations`, etc.

---

## 🔌 MCP Tool Reference

| Tool | Usage |
|------|-------|
| `mcp_clerk_list_clerk_sdk_snippets` | List all available snippets (optionally filter by tag) |
| `mcp_clerk_clerk_sdk_snippet` | Fetch a specific snippet by slug or bundle name |

### Available Bundles
- `b2b-saas` — Complete B2B SaaS setup (orgs, billing, RBAC)
- `auth-basics` — Core hooks: `useUser`, `useAuth`, `useSession`, `useClerk`
- `organizations` — Org management: `useOrganization`, `useOrganizationList`, `OrganizationSwitcher`
- `server-side` — Server Components, API routes, Server Actions, middleware
- `custom-flows` — Custom sign-in/sign-up flows

### Key Individual Slugs
`use-user`, `use-auth`, `use-session`, `use-clerk`, `use-organization`, `use-organization-list`,
`organization-switcher`, `show-component`, `server-auth-nextjs`, `clerk-client-backend`, `billing-integration`

---

## 📦 Package

```bash
# Primary package for Next.js App Router
@clerk/nextjs   # >= 7.x.x

# Backend SDK (server-side admin operations)
@clerk/backend
```

> [!WARNING]
> `<Protect>`, `<SignedIn>`, `<SignedOut>` components are **deprecated** in Clerk v7+. Use `<Show>` instead.

---

## 🔑 Environment Variables

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Webhook (for syncing Clerk events to DB)
CLERK_WEBHOOK_SECRET=whsec_...

# Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

---

## 🏗️ Core Setup

### ClerkProvider (app/layout.tsx)

```typescript
import { ClerkProvider, SignedIn, SignedOut, UserButton, OrganizationSwitcher } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>
          <header>
            <SignedOut>
              <a href="/sign-in">Sign In</a>
            </SignedOut>
            <SignedIn>
              <OrganizationSwitcher
                hidePersonal={true}                    // B2B: no personal workspace
                afterSelectOrganizationUrl="/dashboard"
                afterCreateOrganizationUrl="/onboarding"
                afterLeaveOrganizationUrl="/select-org"
              />
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### Middleware (middleware.ts)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);
const isAdminRoute = createRouteMatcher(['/dashboard/settings(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Allow org selection page through without org check
  if (req.nextUrl.pathname === '/select-org') return;

  if (isProtectedRoute(req)) {
    await auth.protect();

    const { orgId, orgRole } = await auth();

    // B2B: Redirect to org selection if no org active
    if (!orgId) {
      return Response.redirect(new URL('/select-org', req.url));
    }

    // Admin-only routes
    if (isAdminRoute(req) && orgRole !== 'org:admin') {
      return Response.redirect(new URL('/dashboard', req.url));
    }
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

---

## 🪝 Client-Side Hooks

### useAuth — Auth State & Tokens

```typescript
import { useAuth } from '@clerk/nextjs';

const { isLoaded, isSignedIn, userId, orgId, orgRole, orgSlug, getToken, signOut } = useAuth();

// Get Supabase JWT for RLS
const supabaseToken = await getToken({ template: 'supabase' });

// Get standard session token
const token = await getToken();
```

**Return values:**
- `userId` — Current user ID
- `orgId` — Active organization ID (critical for FinOPS multi-tenancy)
- `orgRole` — User's role (`org:admin`, `org:member`, etc.)
- `getToken({ template })` — JWT for backend/integration calls

### useUser — User Object

```typescript
import { useUser } from '@clerk/nextjs';

const { isLoaded, isSignedIn, user } = useUser();

// Key properties
user.id
user.firstName
user.primaryEmailAddress?.emailAddress
user.imageUrl
user.publicMetadata   // visible client-side
user.unsafeMetadata   // user-editable
```

### useOrganization — Active Org

```typescript
import { useOrganization } from '@clerk/nextjs';

const { isLoaded, organization, membership, memberships, invitations } = useOrganization({
  memberships: { infinite: true },
  invitations: { infinite: true },
});

// Role check
const isAdmin = membership?.role === 'org:admin';

// Invite member
await organization?.inviteMember({ emailAddress: 'user@example.com', role: 'org:member' });
```

### useOrganizationList — Switch Orgs

```typescript
import { useOrganizationList } from '@clerk/nextjs';

const { isLoaded, setActive, userMemberships, userInvitations, createOrganization } = useOrganizationList({
  userMemberships: { infinite: true },
});

// Switch organization
await setActive({ organization: orgId });

// Switch to personal (avoid in FinOPS)
await setActive({ organization: null });
```

### useClerk — Advanced Operations

```typescript
import { useClerk } from '@clerk/nextjs';

const clerk = useClerk();

// Programmatic modals
clerk.openSignIn();
clerk.openSignUp();
clerk.openUserProfile();
clerk.openOrganizationProfile();

// Sign out
await clerk.signOut();
```

---

## 🖥️ Server-Side Patterns (App Router)

### Server Components

```typescript
import { auth, currentUser } from '@clerk/nextjs/server';

export default async function DashboardPage() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) redirect('/sign-in');

  const user = await currentUser(); // Full user object when needed

  return <div>Welcome, {user?.firstName}!</div>;
}
```

### API Routes / tRPC Context

```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Always scope queries to orgId for multi-tenancy
  const data = await db.items.findMany({ where: { organizationId: orgId } });
  return Response.json(data);
}
```

### Get Supabase JWT (Server-Side)

```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { getToken } = await auth();
  const supabaseToken = await getToken({ template: 'supabase' });

  // Use this token with Supabase client for RLS enforcement
}
```

### Server Actions

```typescript
'use server';
import { auth } from '@clerk/nextjs/server';

export async function createItem(formData: FormData) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error('Unauthorized');

  await db.items.create({
    data: { name: formData.get('name') as string, organizationId: orgId, userId },
  });
}
```

---

## 🛡️ Authorization (RBAC)

### `<Show>` Component (Clerk v7+)

```typescript
import { Show } from '@clerk/nextjs';

// Auth state
<Show when="signed-in"><p>Welcome back!</p></Show>
<Show when="signed-out"><p>Please sign in.</p></Show>

// Role-based
<Show when={{ role: 'org:admin' }}>
  <AdminPanel />
</Show>

// Permission-based
<Show when={{ permission: 'org:billing:manage' }}>
  <BillingSection />
</Show>

// Custom logic
<Show when={(has) => has({ role: 'org:admin' }) || has({ permission: 'org:billing:manage' })}>
  <ManagementPanel />
</Show>

// With fallback
<Show when={{ role: 'org:admin' }} fallback={<p>Admins only</p>}>
  <Settings />
</Show>
```

> [!CAUTION]
> `<Show>` only hides content visually — HTML is still in the DOM. **Always perform server-side auth checks for sensitive data.**

### Migrate from Deprecated Components

```typescript
// ❌ Deprecated
<Protect role="org:admin">...</Protect>
<SignedIn>...</SignedIn>
<SignedOut>...</SignedOut>

// ✅ Current (v7+)
<Show when={{ role: 'org:admin' }}>...</Show>
<Show when="signed-in">...</Show>
<Show when="signed-out">...</Show>
```

Auto-migrate with:
```bash
npx @clerk/upgrade
```

---

## 🔗 Clerk + Supabase JWT Integration

Clerk issues JWTs that Supabase can verify for RLS enforcement. This is the critical auth bridge in FinOPS.

### 1. Configure JWT Template in Clerk Dashboard

Go to **Configure → JWT Templates** → New template named `supabase`:

```json
{
  "sub": "{{user.id}}",
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}",
  "role": "authenticated"
}
```

### 2. Create Authenticated Supabase Client

```typescript
// lib/supabase/with-auth.ts
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function createAuthenticatedSupabaseClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: 'supabase' });

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );
}
```

### 3. RLS Policy Using Clerk Claims

```sql
-- In Supabase: rows are visible only if the org_id from the JWT matches
CREATE POLICY "tenant_isolation" ON public.transactions
  FOR ALL USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
  );
```

---

## ⚙️ Backend SDK — Admin Operations

```typescript
import { clerkClient } from '@clerk/nextjs/server';

const client = await clerkClient();

// User operations
const user = await client.users.getUser('user_xxx');
await client.users.updateUser('user_xxx', {
  publicMetadata: { role: 'admin' },
  privateMetadata: { internalId: '12345' },
});

// Organization operations
const org = await client.organizations.getOrganization({ organizationId: 'org_xxx' });
await client.organizations.updateOrganization('org_xxx', {
  publicMetadata: { plan: 'pro', stripeCustomerId: 'cus_xxx' },
});

// Membership management
await client.organizations.createOrganizationMembership({
  organizationId: 'org_xxx',
  userId: 'user_xxx',
  role: 'org:admin',
});
await client.organizations.deleteOrganizationMembership({
  organizationId: 'org_xxx',
  userId: 'user_xxx',
});

// Invitations
await client.invitations.createInvitation({
  emailAddress: 'user@example.com',
  redirectUrl: 'https://app.finops.com/accept-invite',
});
```

---

## 🔔 Webhooks

Use Clerk webhooks to sync auth events into the FinOPS database (via Supabase/Drizzle).

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;
  const headerPayload = await headers();

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    const body = await req.text();
    evt = wh.verify(body, {
      'svix-id': headerPayload.get('svix-id')!,
      'svix-timestamp': headerPayload.get('svix-timestamp')!,
      'svix-signature': headerPayload.get('svix-signature')!,
    }) as WebhookEvent;
  } catch {
    return Response.json({ error: 'Invalid webhook' }, { status: 400 });
  }

  switch (evt.type) {
    case 'user.created':
      await db.users.create({
        data: {
          clerkId: evt.data.id,
          email: evt.data.email_addresses[0]?.email_address,
        },
      });
      break;

    case 'organization.created':
      await db.organizations.create({
        data: { clerkId: evt.data.id, name: evt.data.name },
      });
      break;

    case 'organizationMembership.created':
      // Sync membership roles to local DB if needed
      break;
  }

  return Response.json({ received: true });
}
```

**Webhook events to listen for in FinOPS:**
- `user.created` / `user.updated` / `user.deleted`
- `organization.created` / `organization.updated` / `organization.deleted`
- `organizationMembership.created` / `organizationMembership.deleted`

---

## 🧩 FinOPS-Specific Patterns

### tRPC Context with Clerk Auth

```typescript
// server/context.ts
import { auth } from '@clerk/nextjs/server';

export async function createTRPCContext() {
  const { userId, orgId, orgRole } = await auth();
  return { userId, orgId, orgRole };
}
```

### Protected tRPC Procedure

```typescript
// server/trpc.ts
export const orgProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.orgId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { userId: ctx.userId, orgId: ctx.orgId, orgRole: ctx.orgRole } });
});
```

### Admin-Only tRPC Procedure

```typescript
export const adminProcedure = orgProcedure.use(async ({ ctx, next }) => {
  if (ctx.orgRole !== 'org:admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

---

## 🛠️ Troubleshooting

| Symptom | Probable Cause | Fix |
|---------|---------------|-----|
| `orgId` is `null` on dashboard | User has no active org | Redirect to `/select-org` in middleware |
| JWT template not working | Template name mismatch | Verify template name matches `getToken({ template: '...' })` |
| `auth()` returns stale data | Session not refreshed | Call `user.reload()` or force session refresh |
| Supabase RLS rejecting JWT | Claims format wrong | Check JWT template claims match RLS `current_setting` key |
| `<Protect>` import error | Using deprecated API | Replace with `<Show>` from `@clerk/nextjs` |
| `clerkClient` is a function | Clerk v7 API change | Always `await clerkClient()` before using |
| Webhook verification fails | Wrong secret | Confirm `CLERK_WEBHOOK_SECRET` matches Clerk Dashboard value |

---

## 💡 Best Practices (FinOPS)

1. **Always check `orgId`**: Every tRPC procedure and API route must verify both `userId` and `orgId`.
2. **Scope DB queries**: Every Drizzle/Supabase query must filter by `organizationId` from auth context — never trust client-provided orgId.
3. **Use `<Show>` not `<Protect>`**: Fully deprecated in v7; will cause build errors.
4. **Always `await clerkClient()`**: In Clerk v7, `clerkClient` is an async factory function.
5. **JWT template for Supabase**: Always use `getToken({ template: 'supabase' })` specifically — not the raw session token — for Supabase RLS.
6. **RBAC roles format**: Org roles must be prefixed with `org:` (e.g., `org:admin`, `org:member`).
7. **Forward-compatible middleware**: Use `createRouteMatcher` rather than inline pathname checks for maintainability.
8. **Webhook idempotency**: Always handle duplicate webhook delivery — use Svix's `svix-id` as an idempotency key.

---

## 📚 References

- [Clerk Next.js Quickstart](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk + Supabase Integration](https://clerk.com/docs/integrations/databases/supabase)
- [Organizations Overview](https://clerk.com/docs/organizations/overview)
- [Roles & Permissions](https://clerk.com/docs/organizations/roles-permissions)
- [Clerk Webhooks](https://clerk.com/docs/webhooks/overview)
- [Clerk v7 Migration Guide](https://clerk.com/docs/upgrade-guides/core-2)
