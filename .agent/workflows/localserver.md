---
description: Start the local dev server with CWF support
---

# FinOPS Local Dev Server

Starts the Next.js dev server for the FinOPS project.
For the full environment (including Trigger.dev worker), use /ServersUp instead.

// turbo-all

1. Kill any existing process on port 3000:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1; echo "Port 3000 cleared"
```

2. Start the Next.js dev server:
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run dev
```
Wait ~5 seconds and confirm output contains `ready on http://localhost:3000`.

3. (Optional) Start the Trigger.dev worker in a separate terminal if testing AI CFO or background jobs:
```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:dev
```

## Expected Result

| Server | URL |
|--------|-----|
| FinOPS app | http://localhost:3000 |
| Trigger.dev worker | Connected (separate terminal) |
