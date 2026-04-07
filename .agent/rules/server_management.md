# FinOPS Server Management Rule

## Context: FinOPS runs THREE processes locally

| Process | Command | Port | Purpose |
|---------|---------|------|---------|
| Next.js dev | `npm run dev` | 3000 | Main app + tRPC API |
| Trigger.dev worker | `npm run trigger:dev` | N/A (tunnel) | Background job runner (vanna-inference, etc.) |
| (Supabase) | cloud | N/A | Hosted — no local process needed |

---

## CRITICAL: Architecture Awareness

**Never bypass Trigger.dev** to "fix" a stuck job. If a Trigger.dev task is stuck:
1. Check if the Trigger.dev worker is running
2. Start it if missing — do NOT rewrite the architecture

---

## Kill All Local FinOPS Processes

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "trigger" 2>/dev/null
echo "All FinOPS processes killed"
```

## Start — Correct Order

**Step 1: Next.js dev server**
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run dev
```
Wait ~5 seconds for: `▲ Next.js ... ready on http://localhost:3000`

**Step 2: Trigger.dev worker** (separate terminal)
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:dev
```
Wait ~8 seconds for: `Connected to Trigger.dev` and task list to appear.

## Verify

```bash
lsof -i:3000 | grep LISTEN
```
Expected: one LISTEN line for Next.js.

---

## Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Next.js (frontend + API) | 3000 | http://localhost:3000 |
| Trigger.dev worker | tunnel | https://cloud.trigger.dev (dashboard) |

## When to Restart (without asking user)

- After changes to `src/server/jobs/*.ts` → restart Trigger.dev worker
- After changes to `trigger.config.ts` → restart Trigger.dev worker
- After major Next.js config changes → restart Next.js
- Never auto-restart if user has unsaved work visible
