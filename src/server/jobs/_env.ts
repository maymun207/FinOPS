// src/server/jobs/_env.ts
// Lightweight env validator for Trigger.dev job context.
// NEVER import @/env.ts from jobs — it requires Next.js runtime.
// This file uses process.env directly with fail-fast validation.

function get(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Trigger.dev] Missing required env var: ${key}`);
  }
  return val;
}

export const jobEnv = {
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
