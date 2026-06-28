"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/AppProvider";

/** Applies the chosen accent to <html data-accent> so CSS vars re-theme the app. */
export function ThemeSync() {
  const accent = useAppStore((s) => s.accent);
  useEffect(() => {
    document.documentElement.dataset.accent = accent === "blue" ? "" : accent;
  }, [accent]);
  return null;
}
