---
description: Start all three FinOPS local dev servers — Next.js, Trigger.dev worker, and confirm DB connectivity
---

# FinOPS — Start Local Development Environment

Three processes must run simultaneously for full functionality:

| Process | Command | Port | Purpose |
|---|---|---|---|
| Next.js | `npm run dev` | 3000 | Frontend + tRPC API |
| Trigger.dev worker | `npm run trigger:dev` | — | Background job executor (AI CFO, cron jobs) |

---

## Steps

1. Start the Next.js frontend dev server (Terminal 1):

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run dev
```

Wait ~5 seconds, confirm output contains `▲ Next.js` and `Local: http://localhost:3000`.

2. Start the Trigger.dev worker (Terminal 2):

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:dev
```

Wait ~10 seconds. The worker will:
- Connect to Trigger.dev cloud using your `TRIGGER_SECRET_KEY`
- Register all 8 tasks from `src/server/jobs/`
- Print each registered task ID (e.g. `✓ vanna-inference`, `✓ audit-anomaly-digest`)

Look for output like:
```
 ✓ Connected to Trigger.dev
 ✓ Registered 8 tasks
```

> [!IMPORTANT]
> The Trigger.dev worker is required for the **AI Mali Müşavir (/cfo)** page to work.
> Without it, questions will appear to "hang" indefinitely because the job is queued
> but nobody is executing it locally.

---

## Confirming Both Are Running

- `/cfo` page: Type a question and it should respond within ~5–15 seconds
- `/admin/audit`: Check audit log entries
- Trigger.dev dashboard: Visit https://app.trigger.dev to see live run status

---

## Stopping

```bash
# Kill Next.js (Ctrl+C in Terminal 1)
# Kill Trigger worker (Ctrl+C in Terminal 2)
```

---

## Notes

- The `trigger:dev` command reads `.env.local` automatically via `--env-file .env.local`
- If the worker fails to start with "missing env var", it means a task's required env var (e.g. `CLOUDFLARE_R2_*`) is not set — but `vanna-inference` and `vanna-training-update` do NOT need R2 keys and will work regardless
- Sentry proxy ECONNRESET errors in Next.js terminal are expected locally and do not affect functionality
