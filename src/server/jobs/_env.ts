// src/server/jobs/_env.ts
// Lightweight env validator for Trigger.dev job context.
// NEVER import @/env.ts from jobs — it requires Next.js runtime.
//
// IMPORTANT: This file uses a LAZY function (getJobEnv) instead of
// an eagerly-evaluated module-level object. This allows the Trigger.dev
// worker to start successfully even when optional env vars (R2, Resend)
// are not yet configured. Tasks that need those vars will fail at
// execution time with a clear message, not at worker startup.

function get(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Trigger.dev] Missing required env var: ${key}`);
  }
  return val;
}

export function getJobEnv() {
  return {
    // Supabase (used by all jobs)
    SUPABASE_URL:              get('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_DB_URL:           get('SUPABASE_DB_URL'),
    // Cloudflare R2 (used by excel-import-large, report-generate)
    R2_ACCOUNT_ID:             get('CLOUDFLARE_R2_ACCOUNT_ID'),
    R2_ACCESS_KEY_ID:          get('CLOUDFLARE_R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY:      get('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
    R2_BUCKET_NAME:            get('CLOUDFLARE_R2_BUCKET_NAME'),
    // Email (used by billing-reminder-daily)
    RESEND_API_KEY:            get('RESEND_API_KEY'),
    // AI (used by report-generate)
    GEMINI_API_KEY:            get('GEMINI_API_KEY'),
  } as const;
}

// Supabase-only subset — for jobs that don't need R2/Resend
export function getSupabaseEnv() {
  return {
    SUPABASE_URL:              get('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_DB_URL:           get('SUPABASE_DB_URL'),
    GEMINI_API_KEY:            get('GEMINI_API_KEY'),
  } as const;
}
