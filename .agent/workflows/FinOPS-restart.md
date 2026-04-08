---
description: Kill all FinOPS local servers, rebuild Trigger.dev worker, deploy to cloud, and start everything cleanly
---

# FinOPS — Full Clean Restart

Use this when:
- Something is stuck or behaving oddly
- You just made code changes and want a guaranteed clean state
- After a long session where workers may have gone stale
- Before demoing or testing end-to-end

---

## Steps

// turbo
1. Kill the Next.js dev server (port 3000):

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; echo "Port 3000 cleared"
```

// turbo
2. Kill any existing Trigger.dev worker process:

```bash
pkill -f "trigger.dev" 2>/dev/null; pkill -f "trigger:dev" 2>/dev/null; sleep 1; echo "Trigger.dev worker stopped"
```

// turbo
3. Type-check the codebase (catch any compile errors before starting):

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20 && echo "✓ TypeScript OK"
```

4. Deploy tasks to Trigger.dev cloud (production workers):

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:deploy 2>&1 | tail -6
```

Wait for output: `Version XXXXXXXX.X deployed with 8 detected tasks`

// turbo
5. Start the Next.js dev server:

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run dev
```

Wait until you see: `▲ Next.js` and `Local: http://localhost:3000`

// turbo
6. Start the Trigger.dev local worker:

```bash
cd /Users/tunckahveci/Desktop/FinOPS && npm run trigger:dev
```

Wait until you see: `○ Local worker ready [node] -> XXXXXXXX.X`

> [!NOTE]
> The `■  Error: Warning: --localstorage-file` lines are **harmless** — they are
> Node.js warnings from the Trigger.dev CLI, not errors from your code.

---

## Verification

After both servers are running:

| Check | Expected |
|---|---|
| Open `localhost:3000` | FinOPS dashboard loads |
| Open `localhost:3000/cfo` | Sanal CFO page loads |
| Ask a question in `/cfo` | Responds in ~5–15 seconds |
| Trigger.dev dashboard → Runs | New run appears and completes ✅ |

---

## Port Reference

| Service | Port | Process |
|---|---|---|
| Next.js | 3000 | `npm run dev` |
| Trigger.dev worker | — (cloud connection) | `npm run trigger:dev` |

---

## Notes

- Steps 1–4 can be auto-run (`// turbo` steps). Steps 5–6 **must** be run in separate terminals.
- The local Trigger.dev worker (`trigger:dev`) handles **Development** environment runs.
- The cloud deploy (`trigger:deploy`) handles **Production** environment runs (Vercel).
- Both must be in sync for full local + production coverage.
