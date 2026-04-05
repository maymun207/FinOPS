import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Root Zustand store.
 *
 * Slice pattern: combine slices here as the app grows.
 *
 * @example
 * import { createInvoiceSlice } from "./slices/invoice";
 *
 * export const useStore = create<RootState>()(
 *   devtools((...args) => ({
 *     ...createInvoiceSlice(...args),
 *   }))
 * );
 */

interface RootState {
  // TODO: add slices
  _hydrated: boolean;
  setHydrated: (value: boolean) => void;
}

export const useStore = create<RootState>()(
  devtools(
    (set) => ({
      _hydrated: false,
      setHydrated: (value) => { set({ _hydrated: value }); },
    }),
    { name: "finops-store" },
  ),
);
