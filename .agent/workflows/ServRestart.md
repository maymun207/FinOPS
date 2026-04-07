---
description: Restart the FinOPS local dev environment (Next.js + Trigger.dev worker)
---

# ServRestart — Restart FinOPS Dev Servers

Kills and restarts the Next.js app and the Trigger.dev worker.

## Steps

### Step 1 — Kill Next.js (port 3000)
// turbo
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -f "next dev" 2>/dev/null; echo "Next.js killed"
```

### Step 2 — Kill Trigger.dev worker
// turbo
```bash
pkill -f "trigger" 2>/dev/null; sleep 1; echo "Trigger.dev worker killed"
```

### Step 3 — Start Next.js
// turbo
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run dev
```
Wait ~5 seconds for: `ready on http://localhost:3000`

### Step 4 — Start Trigger.dev worker
// turbo
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:dev
```
Wait ~8 seconds for: `Connected to Trigger.dev`

### Step 5 — Verify Next.js responds
// turbo
```bash
curl -s -o /dev/null -w "Next.js: %{http_code}" --max-time 5 http://localhost:3000/
```
Expected: `Next.js: 200` or `307` (redirect to sign-in).
