---
name: finops
description: >
  Living knowledge base for the FinOPS project — a virtual CFO platform built on
  Next.js 15 / tRPC / Supabase / Clerk / Drizzle. Use this skill when making
  architectural decisions, implementing financial features, or reviewing domain logic.
  Update this file as the project evolves.
---

# FinOPS — Virtual CFO Knowledge Base

> **Mission:** Build an AI-powered virtual CFO that learns the business as it grows —
> surfacing insights, automating financial operations, and eventually acting as an
> intelligent financial co-pilot.

---

## 1. Project Vision

| Dimension | Description |
|-----------|-------------|
| **What** | A financial operations platform that evolves into a virtual CFO |
| **Who** | SMEs and startups that cannot afford a full-time CFO |
| **How** | AI-assisted financial intelligence + automated workflows + real-time dashboards |
| **Endgame** | Proactive financial advisor: forecasts, anomaly detection, compliance, cash flow optimization |

### Evolution Stages

```
Phase 1 — Foundation    : Data ingestion, categorization, basic reporting
Phase 2 — Intelligence  : Anomaly detection, trend analysis, AI summaries
Phase 3 — Automation    : Approval workflows, payment scheduling, reconciliation
Phase 4 — Virtual CFO   : Proactive recommendations, scenario planning, board reporting
```

---

## 2. Tech Stack & Rationale

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | RSC for heavy data pages, streaming, server actions |
| API | tRPC v11 + superjson | End-to-end type safety, no codegen, React 19 compatible |
| Auth | Clerk | Multi-org support critical for multi-entity CFO use case |
| Database | Supabase (Postgres) + Drizzle ORM | RLS for row-level tenancy, type-safe queries |
| Storage | Cloudflare R2 | Invoice/document storage, egress-free |
| AI | Gemini API | Financial analysis, document parsing, natural language queries |
| Background | Trigger.dev | Scheduled reconciliation, email digests, async AI jobs |
| Email | Resend | Financial report delivery, approval notifications |
| Monitoring | Sentry + Axiom | Error tracking + financial event audit logs |
| State | Zustand (slice pattern) | Client UI state, optimistic updates |

---

## 3. Architecture Decisions (ADRs)

### ADR-001 — Multi-tenancy via Clerk Organizations
- **Decision:** Use Clerk `orgId` as the primary tenant discriminator
- **Rationale:** Clerk handles SSO, invitations, and role management out-of-box
- **Consequence:** Every Supabase RLS policy must filter on `(auth.jwt() ->> 'org_id')`
- **Status:** Active

### ADR-002 — Drizzle over Supabase client for DB queries
- **Decision:** Use Drizzle ORM for all application queries; Supabase client only for auth/storage
- **Rationale:** Type-safe schema, migrations as code, better for complex financial queries
- **Consequence:** Schema lives in `src/server/db/schema.ts`; migrations in `supabase/migrations/`
- **Status:** Pending implementation

### ADR-003 — tRPC `fetchRequestHandler` (App Router pattern)
- **Decision:** All API routes via tRPC fetch adapter, no `createNextApiHandler`
- **Rationale:** App Router compatibility, streaming support, Edge Runtime ready
- **Status:** ✅ Implemented

### ADR-004 — Server-only guard on service role client
- **Decision:** `import "server-only"` as first line of `src/lib/supabase/server.ts`
- **Rationale:** Prevents service role key leaking into client bundle (build-time error)
- **Status:** ✅ Implemented

### ADR-005 — Exact version pinning for tRPC
- **Decision:** No `^` prefix on `@trpc/*` packages
- **Rationale:** React 19 type compatibility is fragile; wildcard updates break builds
- **Status:** ✅ Implemented

---

## 4. Domain Model (Evolving)

### Core Financial Entities

```
Organization (Clerk)
├── Chart of Accounts        — account hierarchy (assets, liabilities, equity, income, expense)
├── Transactions             — every money movement (debit/credit)
│   ├── Invoices (AR)        — money owed TO the org
│   ├── Bills (AP)           — money owed BY the org
│   └── Bank Transactions    — imported from bank/CSV
├── Vendors                  — suppliers, contractors
├── Customers                — clients
├── Budget                   — planned vs actual by period
├── Documents                — invoices, receipts, contracts (R2 storage)
└── AI Insights              — generated summaries, anomalies, recommendations
```

### Key Financial Concepts to Encode

| Concept | Description | Implementation Note |
|---------|-------------|---------------------|
| Double-entry bookkeeping | Every transaction affects ≥2 accounts | Enforce in DB with trigger or app layer |
| Chart of Accounts (CoA) | Hierarchical account tree | Seed with standard SME CoA on org creation |
| Accrual vs Cash basis | Two reporting modes | Flag on org settings, affects query logic |
| Reconciliation | Match bank transactions to invoices/bills | Core Phase 2 feature |
| Period closing | Lock past periods from editing | Soft-lock with `closed_at` timestamp |

---

## 5. Established Patterns

### tRPC Router Structure
```
src/server/trpc/
├── trpc.ts         — init, context (Clerk auth), publicProcedure, protectedProcedure
├── root.ts         — combineRouters
└── routers/
    ├── invoice.ts  — AR operations
    ├── bill.ts     — AP operations
    ├── account.ts  — Chart of Accounts CRUD
    └── ...
```

### Supabase RLS Pattern
```sql
-- Every table follows this pattern:
CREATE POLICY "org_isolation" ON <table>
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

### Drizzle Schema Pattern
```typescript
// Every financial table includes audit + org isolation:
export const baseColumns = {
  id:        uuid('id').primaryKey().defaultRandom(),
  orgId:     uuid('org_id').notNull(),       // Clerk org_id
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: text('created_by'),             // Clerk userId
};
```

---

## 6. Financial Intelligence Roadmap

### Planned AI Features
1. **Document parsing** — OCR + Gemini to extract invoice data from PDFs
2. **Auto-categorization** — ML classification of transactions to CoA
3. **Anomaly detection** — flag unusual spend patterns
4. **Cash flow forecasting** — 30/60/90 day projections
5. **Natural language queries** — "How much did we spend on marketing last quarter?"
6. **Board report generation** — monthly P&L, balance sheet, cash flow statement as PDF

---

## 7. Key Learnings (Updated as we build)

| Date | Learning |
|------|----------|
| 2026-04-05 | Infrastructure foundation complete: tRPC, Clerk, Supabase, Drizzle, env validation all wired |
| 2026-04-05 | `@trpc/next` is Pages Router only — remove from App Router projects |
| 2026-04-05 | `import "server-only"` must be first line of any file using SUPABASE_SERVICE_ROLE_KEY |
| 2026-04-05 | vitest env tests: use `@vitest-environment node` + `vi.resetModules()` for t3-env isolation |
| 2026-04-05 | ClerkProvider must be the outermost provider in layout.tsx (outside TRPCReactProvider) |

---

## 8. Update Protocol

When a new pattern is established or a key decision is made, update this file:

1. Add to **ADRs** section if it's an architectural decision
2. Add to **Patterns** section if it's a reusable code pattern  
3. Add to **Key Learnings** if it's a gotcha or non-obvious insight
4. Update **Domain Model** as new entities are designed

> This file is the project's long-term memory. Keep it current.
