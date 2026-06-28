"use client";

/**
 * Mounts the Zustand store in the root layout (client provider) and exposes a
 * typed `useAppStore` selector hook. Store is created once per mount (useRef)
 * so server requests never share state.
 */
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { roasColor } from "@/lib/format";
import { createAppStore, type AppStore } from "./useAppStore";

type StoreApi = ReturnType<typeof createAppStore>;

const AppStoreContext = createContext<StoreApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createAppStore();
  }
  return (
    <AppStoreContext.Provider value={storeRef.current}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore must be used within <AppProvider>");
  }
  return useStore(store, selector);
}

/** Returns a roasColor() bound to the live colorByPerformance flag. */
export function usePerfColor(): (v: number) => string {
  const flag = useAppStore((s) => s.colorByPerformance);
  return (v: number) => roasColor(v, flag);
}
