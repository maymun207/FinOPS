// src/lib/supabase/use-supabase.ts
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createAuthenticatedClient } from "./client";

export function useSupabase() {
    const { getToken } = useAuth();

    const getClient = async () => {
        const token = await getToken({ template: "supabase" });
        return createAuthenticatedClient(token);
    };

    return { getClient };
}