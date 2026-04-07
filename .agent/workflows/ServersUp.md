---
description: Start all FinOPS local dev servers (Next.js + Trigger.dev worker)
---

# ServersUp — Start FinOPS Dev Environment

Starts the Next.js app (port 3000) and the Trigger.dev worker (background job runner).
Both must be running for the AI CFO (vanna-inference) and other background tasks to work.

## Steps

// turbo-all

1. Kill any existing FinOPS processes:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "trigger" 2>/dev/null; sleep 1; echo "Processes cleared"
```

2. Start the Next.js dev server:
```bash
npm run dev
```
Run in: `/Users/tunckahveci/Desktop/FinOPS`
Wait ~5 seconds and confirm output contains `ready on http://localhost:3000`.

3. Start the Trigger.dev worker (in a separate terminal):
```bash
npm run trigger:dev
```
Run in: `/Users/tunckahveci/Desktop/FinOPS`
Wait ~8 seconds and confirm output shows `Connected to Trigger.dev` and lists registered tasks including `vanna-inference`.

## Expected Result

| Server | Status |
|--------|--------|
| Next.js | http://localhost:3000 |
| Trigger.dev worker | Connected (see terminal output) |

## Notes

- The Trigger.dev worker uses a tunnel to Trigger.dev cloud — no local port is opened.
- Tasks are dispatched via `TRIGGER_SECRET_KEY` in `.env.local`.
- You can monitor running tasks at https://cloud.trigger.dev
