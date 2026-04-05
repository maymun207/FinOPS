import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Category mapping shape — matches tRPC categoryMapping.list output.
 */
export interface CategoryMapping {
  id: string;
  categoryLabel: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  createdAt: Date;
}

interface CategoryMappingsState {
  /** Cached category→account mappings for the current company */
  mappings: CategoryMapping[];
  /** Whether the store has been populated */
  isLoaded: boolean;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Last fetch error, if any */
  error: string | null;

  /** Replace the entire mappings array (called after tRPC fetch) */
  setMappings: (mappings: CategoryMapping[]) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all cached mappings */
  clear: () => void;

  /**
   * Find the TDHP account for a given category label.
   * Returns null if no mapping exists for that label.
   */
  getAccountForCategory: (
    label: string
  ) => { accountId: string; accountCode: string; accountName: string } | null;
}

/**
 * Zustand store for category mappings.
 *
 * Standalone store (not merged into root) — populated on app mount
 * via the useCategoryMappingsSync hook.
 *
 * Usage:
 *   const mappings = useCategoryMappingsStore(s => s.mappings);
 *   const resolve = useCategoryMappingsStore(s => s.getAccountForCategory);
 *   const account = resolve("Ofis Malzemeleri");
 */
export const useCategoryMappingsStore = create<CategoryMappingsState>()(
  devtools(
    (set, get) => ({
      mappings: [],
      isLoaded: false,
      isLoading: false,
      error: null,

      setMappings: (mappings) => {
        set({ mappings, isLoaded: true, isLoading: false, error: null });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error, isLoading: false });
      },

      clear: () => {
        set({ mappings: [], isLoaded: false, isLoading: false, error: null });
      },

      getAccountForCategory: (label: string) => {
        const { mappings } = get();
        const normalized = label.toLowerCase().trim();
        const match = mappings.find(
          (m) => m.categoryLabel.toLowerCase().trim() === normalized
        );
        if (!match) return null;
        return {
          accountId: match.accountId,
          accountCode: match.accountCode,
          accountName: match.accountName,
        };
      },
    }),
    { name: "category-mappings-store" }
  )
);
