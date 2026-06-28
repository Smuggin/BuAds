/**
 * Formatters — framework-agnostic (no React/Next). The single place numbers turn
 * into strings. See .ai/kpi-engine.md §6 and .ai/conventions.md (mono numbers).
 */
import type { MetricDir, MetricKey } from "@/data/types";

export const PERF_COLORS = {
  success: "#1f8a5b",
  ink: "#16181d",
  warn: "#c98a16",
  danger: "#d6453d",
} as const;

export const round1 = (v: number): number => Math.round(v * 10) / 10;

/** ฿ + grouped thousands, no decimals. */
export const fmtMoney = (v: number): string =>
  "฿" + Math.round(v).toLocaleString("en-US");

/** roas → `4.6x`, ctr → `1.8%`, money metrics → `฿1,600`. */
export function fmtMetric(key: MetricKey, value: number): string {
  if (key === "roas") return round1(value) + "x";
  if (key === "ctr") return round1(value) + "%";
  return fmtMoney(value);
}

/** Direction symbol for a threshold: `≥` for min metrics, `≤` for max. */
export const dirSymbol = (dir: MetricDir): "≥" | "≤" => (dir === "min" ? "≥" : "≤");

/** Compact counts (impressions etc.): 1000+ → `1.2K`. */
export const fmtK = (v: number): string =>
  v >= 1000 ? round1(v / 1000) + "K" : String(v);

/**
 * Performance color for a ROAS value. With colorByPerformance off, everything is ink.
 * ≥5 success · ≥4 ink · ≥3 warn · else danger.
 */
export function roasColor(v: number, colorByPerformance = true): string {
  if (!colorByPerformance) return PERF_COLORS.ink;
  if (v >= 5) return PERF_COLORS.success;
  if (v >= 4) return PERF_COLORS.ink;
  if (v >= 3) return PERF_COLORS.warn;
  return PERF_COLORS.danger;
}
