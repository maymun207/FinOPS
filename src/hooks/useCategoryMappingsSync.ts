"use client";

/**
 * useCategoryMappingsSync — TanStack Query hook to populate the Zustand store.
 *
 * Call this hook once in a top-level layout/provider. It:
 *   1. Fetches category mappings from tRPC on mount
 *   2. Populates the Zustand store with the results
 *   3. Falls back to an empty map on error — never crashes
 *
 * Usage:
 *   function DashboardLayout({ children }) {
 *     useCategoryMappingsSync();
 *     return <>{children}</>;
 *   }
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useCategoryMappingsStore } from "@/store/category-mappings.store";

export function useCategoryMappingsSync() {
  const setMappings = useCategoryMappingsStore((s) => s.setMappings);
  const setLoading = useCategoryMappingsStore((s) => s.setLoading);
  const setError = useCategoryMappingsStore((s) => s.setError);
  const isLoaded = useCategoryMappingsStore((s) => s.isLoaded);

  const { data, error, isLoading } = trpc.categoryMapping.list.useQuery(
    undefined,
    {
      // Only fetch once — category mappings rarely change
      refetchOnWindowFocus: false,
      refetchOnMount: !isLoaded,
      retry: 1,
    }
  );

  useEffect(() => {
    if (isLoading) {
      setLoading(true);
      return;
    }

    if (error) {
      // Graceful fallback — never crash, just log and use empty map
      console.warn("[CategoryMappingsSync] Failed to load:", error.message);
      setError(error.message);
      return;
    }

    if (data) {
      setMappings(data);
    }
  }, [data, error, isLoading, setMappings, setLoading, setError]);
}
