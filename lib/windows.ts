/**
 * Insight time-window helpers, shared by the sync, the read-APIs, and the UI
 * range control. A snapshot's `window` column stores the KEY below.
 *
 * Presets (last_7d/30d/90d) are synced on the regular schedule. "today" and
 * "custom" are synced on demand when selected (see lib/meta/syncRange.ts) and
 * stored under the keys "today" / "custom" (custom reuses one slot, overwritten).
 */
export const INSIGHT_WINDOWS = ["last_7d", "last_30d", "last_90d"] as const;
export type InsightWindow = (typeof INSIGHT_WINDOWS)[number];

/** Hard cap on any custom range span (Meta/product limit). */
export const MAX_RANGE_DAYS = 90;

const RANGE_TO_WINDOW: Record<string, string> = {
  today: "today",
  "7d": "last_7d",
  "30d": "last_30d",
  "90d": "last_90d",
  custom: "custom",
};

/** UI RangeId → stored snapshot window key. Defaults to last_30d. */
export const rangeToWindow = (range: string | null | undefined): string =>
  RANGE_TO_WINDOW[range ?? "30d"] ?? "last_30d";

/** Whole days between two ISO dates (inclusive), clamped to [1, MAX_RANGE_DAYS]. */
export function spanDays(since?: string | null, until?: string | null): number {
  if (!since || !until) return 30;
  const ms = Date.parse(until) - Date.parse(since);
  if (Number.isNaN(ms)) return 30;
  const days = Math.floor(ms / 86_400_000) + 1; // inclusive
  return Math.min(MAX_RANGE_DAYS, Math.max(1, days));
}

/** Days in a window — turns windowed spend into a daily cost (Cost/วัน).
 *  For "custom" pass the span (from since/until); "today" is a single day. */
export const windowDays = (window: string, customSpan?: number): number => {
  if (window === "today") return 1;
  if (window === "custom") return customSpan && customSpan > 0 ? customSpan : 30;
  if (window === "last_7d") return 7;
  if (window === "last_90d") return 90;
  return 30;
};

/** A resolvable insight time selection: a Meta date_preset OR an explicit range. */
export interface TimeSpec {
  key: string; // snapshot window key (today | last_* | custom)
  datePreset?: string; // Meta date_preset (today | last_7d | ...)
  since?: string; // custom range start (YYYY-MM-DD)
  until?: string; // custom range end (YYYY-MM-DD)
}

/** UI range (+ optional custom dates) → the TimeSpec used to fetch + store. */
export function rangeToSpec(
  range: string,
  custom?: { since: string; until: string } | null,
): TimeSpec {
  if (range === "custom" && custom?.since && custom?.until) {
    return { key: "custom", since: custom.since, until: custom.until };
  }
  const preset = range === "today" ? "today" : rangeToWindow(range);
  return { key: rangeToWindow(range), datePreset: preset };
}

/** TimeSpec → Graph API params (date_preset or time_range). */
export function timeParams(spec: TimeSpec): Record<string, string> {
  if (spec.since && spec.until) {
    return { time_range: JSON.stringify({ since: spec.since, until: spec.until }) };
  }
  return { date_preset: spec.datePreset ?? "last_30d" };
}
