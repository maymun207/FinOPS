# FinOPS

> Financial Operations Platform built with Next.js, Supabase, and Clerk.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js (App Router) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Clerk + Supabase JWT integration |
| **Background Jobs** | Trigger.dev |
| **File Storage** | Cloudflare R2 |
| **AI** | Google Gemini |
| **Email** | Resend |
| **Logging** | Axiom |
| **Error Tracking** | Sentry |

---

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url>
cd FinOPS
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your real credentials. See `.env.example` for all required variables.

### 4. Start development server

```bash
pnpm dev
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list of required environment variables.

| Variable | Service | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | ✅ |
| `SUPABASE_DB_URL` | Supabase | ✅ |
| `SUPABASE_DB_URL_UNPOOLED` | Supabase | ✅ (migrations only) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | ✅ |
| `CLERK_SECRET_KEY` | Clerk | ✅ |
| `TRIGGER_SECRET_KEY` | Trigger.dev | ✅ |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare R2 | ✅ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 | ✅ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 | ✅ |
| `CLOUDFLARE_R2_BUCKET_NAME` | Cloudflare R2 | ✅ |
| `GEMINI_API_KEY` | Google Gemini | ✅ |
| `RESEND_API_KEY` | Resend | ✅ |
| `AXIOM_TOKEN` | Axiom | ⚠️ optional in dev |
| `SENTRY_DSN` | Sentry | ⚠️ optional in dev |

---

## Project Structure

```
FinOPS/
├── .agent/          # AI agent skills, rules & workflows
├── .env             # Local env variables (never commit!)
├── .env.example     # Template for env variables
├── .gitignore
└── README.md
```

---

## Supabase

This project uses [Supabase](https://supabase.com) as the primary database and backend.

- Migrations are tracked in `supabase/migrations/`
- TypeScript types are auto-generated in `src/types/supabase.ts`
- Auth is handled via Clerk + Supabase Third Party Auth integration
