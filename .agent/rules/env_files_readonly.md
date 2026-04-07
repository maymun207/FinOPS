# RULE: .env* Files Are Read-Only

## ⛔ NEVER modify any .env* files under any circumstances.

This applies to ALL environment files in the FinOPS project, including but not limited to:

- `.env.local`
- `.env`
- `.env.production`
- `.env.development`
- `.env.test`
- Any file matching `.env*`

## What to do instead

If you need to document required environment variables or suggest changes:

1. **Write to `REQUIRED_ENV.md`** in the project root — document the variable name, purpose, and example value there.
2. **Never write, edit, append, or overwrite** any `.env*` file using any tool (`write_to_file`, `replace_file_content`, `multi_replace_file_content`, `run_command` with `echo >>`, etc.).
3. **Tell the user** what value needs to be set and in which file — let the user make the change themselves.

## Why

Environment files contain production credentials, API keys, and secrets. Automated modification — even with good intent — risks corrupting credentials, exposing secrets in git history, or breaking production connections.

## Examples of FORBIDDEN actions

```bash
# FORBIDDEN
echo "NEW_VAR=value" >> .env.local

# FORBIDDEN
sed -i 's/OLD/NEW/' .env.local
```

```ts
// FORBIDDEN — writing to .env.local via any file tool
write_to_file(".env.local", ...)
replace_file_content(".env.local", ...)
```

## Correct approach

> "You need to set `SUPABASE_DB_URL` in your `.env.local` to:
> `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`
> Please update it manually."
