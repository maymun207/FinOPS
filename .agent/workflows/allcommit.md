---
description: Commit all local changes to git and push to GitHub
---

# All Commit — FinOPS

Commits everything in the working tree to local git and pushes to `origin/main` on GitHub.

// turbo-all

## Steps

1. Check what will be committed:
```bash
cd /Users/tunckahveci/Desktop/FinOPS && git status
```

2. Stage all changes:
```bash
cd /Users/tunckahveci/Desktop/FinOPS && git add -A
```

3. Commit with a descriptive message (replace MESSAGE with actual description):
```bash
cd /Users/tunckahveci/Desktop/FinOPS && git commit -m "MESSAGE"
```

4. Push to GitHub:
```bash
cd /Users/tunckahveci/Desktop/FinOPS && git push origin main
```

5. Confirm push succeeded — look for `main -> main` in the output.

## Rules

- Always run `npx tsc --noEmit` and `npx eslint` before committing if source files changed
- Use conventional commit format: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Never commit `.env*` files — they are in `.gitignore`
- Never commit `*.tsbuildinfo` or `.next/` — they are in `.gitignore`
