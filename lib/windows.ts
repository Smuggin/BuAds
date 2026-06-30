/**
 * Insight time-window helpers, shared by the sync, the read-APIs, and the UI
 * range buttons (7D/30D/90D). `window` is the Meta date_preset string we also
 * store on InsightSnapshot.window / BreakdownSnapshot.window.
 */
export const INSIGHT_WINDOWS = ["last_7d", "last_30d", "last_90d"] as const;
export type InsightWindow = (typeof INSIGHT_WINDOWS)[number];

const RANGE_TO_WINDOW: Record<string, InsightWindow> = {
  "7d": "last_7d",
  "30d": "last_30d",
  "90d": "last_90d",
};

/** UI RangeId ("7d"|"30d"|"90d") → stored window. Defaults to last_30d. */
export const rangeToWindow = (range: string | null | undefined): InsightWindow =>
  RANGE_TO_WINDOW[range ?? "30d"] ?? "last_30d";

/** Days in a window — used to turn windowed spend into a daily cost (Cost/วัน). */
export const windowDays = (window: string): number =>
  window === "last_7d" ? 7 : window === "last_90d" ? 90 : 30;
