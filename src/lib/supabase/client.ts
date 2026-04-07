// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@clerk/nextjs";
import { env } from "@/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Use this version in any component that needs authenticated data
export function createAuthenticatedClient(token: string | null) {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      },
    }
  );
}