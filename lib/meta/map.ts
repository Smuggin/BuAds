/**
 * Map Meta Graph API JSON → our Prisma rows / metric shapes. Pure.
 * Encodes the field→MetricKey mapping + money-unit rules from .ai/meta-integration.md.
 */
import type { CreativeFormat as PrismaFormat } from "@prisma/client";
import type { AudienceProfile } from "@/data/types";

type ActionList = { action_type: string; value: string }[];

export interface MetaInsightRow {
  campaign_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  purchase_roas?: ActionList;
  actions?: ActionList;
  cost_per_action_type?: ActionList;
  // Video funnel (each is an action-typed list; we read the first value).
  video_play_actions?: ActionList;
  video_thruplay_watched_actions?: ActionList;
  video_p25_watched_actions?: ActionList;
  video_p50_watched_actions?: ActionList;
  video_p75_watched_actions?: ActionList;
  video_p100_watched_actions?: ActionList;
  video_avg_time_watched_actions?: ActionList;
}

/** Synced insight window length. The `cost` KPI is daily (Cost/วัน), so spend is
 *  averaged over this many days rather than compared as a 30-day total. */
export const INSIGHT_WINDOW_DAYS = 30;

const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

const num = (s: string | undefined): number => (s ? parseFloat(s) : 0);

/** Safe divide — never NaN/Infinity (0 when denominator is 0). */
const div = (a: number, b: number): number => (b ? a / b : 0);

function pickAction(arr: ActionList | undefined, types: string[]): number {
  if (!arr) return 0;
  for (const t of types) {
    const hit = arr.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return 0;
}

/** First value of an action-typed list (the video_* fields each carry one row). */
const firstVal = (arr: ActionList | undefined): number => (arr?.length ? num(arr[0].value) : 0);

/** Extract the 7 judged KPIs (+ extras) from an insights row. */
export function insightMetrics(r: MetaInsightRow) {
  const spend = num(r.spend);
  const purchases = pickAction(r.actions, PURCHASE_TYPES);
  const roas = r.purchase_roas?.length ? num(r.purchase_roas[0].value) : 0;
  const cpPurchase = pickAction(r.cost_per_action_type, PURCHASE_TYPES);
  return {
    spend,
    impressions: Math.round(num(r.impressions)),
    clicks: Math.round(num(r.clicks)),
    ctr: num(r.ctr),
    cpm: num(r.cpm),
    reach: Math.round(num(r.reach)),
    frequency: num(r.frequency),
    roas,
    purchases: Math.round(purchases),
    cpa: cpPurchase, // cost per purchase (our cpa baseline)
    cpp: cpPurchase, // our cpp = cost/purchase (NOT Meta's reach-based cpp)
    cpr: cpPurchase, // cost/result proxy until per-goal results are pulled
  };
}

// Engagement action_types in the insights `actions` array (best-effort names).
const REACTION_TYPES = ["post_reaction"];
const COMMENT_TYPES = ["comment"];
const SHARE_TYPES = ["post"]; // Meta labels shares as action_type "post"
const SAVE_TYPES = ["onsite_conversion.post_save"];
const POST_ENGAGEMENT_TYPES = ["post_engagement"];
// 3-second video plays live in the `actions` array, not in a video_* field.
const VIDEO_VIEW_TYPES = ["video_view"];

/** Per-creative video funnel from one ad insights row. Rates are percentages. */
export function videoMetrics(r: MetaInsightRow) {
  const impressions = num(r.impressions);
  const plays3s = pickAction(r.actions, VIDEO_VIEW_TYPES);
  const thruplays = firstVal(r.video_thruplay_watched_actions);
  return {
    plays3s: Math.round(plays3s),
    thruplays: Math.round(thruplays),
    p25: Math.round(firstVal(r.video_p25_watched_actions)),
    p50: Math.round(firstVal(r.video_p50_watched_actions)),
    p75: Math.round(firstVal(r.video_p75_watched_actions)),
    p100: Math.round(firstVal(r.video_p100_watched_actions)),
    avgWatchSec: firstVal(r.video_avg_time_watched_actions),
    hookRate: div(plays3s, impressions) * 100, // scroll-stop: 3s plays / impressions
    holdRate: div(thruplays, impressions) * 100, // ThruPlay / impressions
  };
}
export type VideoMetrics = ReturnType<typeof videoMetrics>;

/** Per-creative post engagement from one ad insights row (windowed, paid). */
export function engagementMetrics(r: MetaInsightRow) {
  return {
    reactions: Math.round(pickAction(r.actions, REACTION_TYPES)),
    comments: Math.round(pickAction(r.actions, COMMENT_TYPES)),
    shares: Math.round(pickAction(r.actions, SHARE_TYPES)),
    saves: Math.round(pickAction(r.actions, SAVE_TYPES)),
    postEngagement: Math.round(pickAction(r.actions, POST_ENGAGEMENT_TYPES)),
  };
}
export type EngagementMetrics = ReturnType<typeof engagementMetrics>;

/**
 * Fold many ad-level insight rows that share one creative into a single
 * creative-level aggregate. Additive counts are summed; rates are RECOMPUTED
 * from the sums (never averaged). Returns the 12 snapshot KPIs plus nested
 * `video`/`engagement` for the InsightSnapshot JSON columns.
 */
export function aggregateInsights(rows: MetaInsightRow[]) {
  let spend = 0,
    impressions = 0,
    clicks = 0,
    reach = 0, // NOTE: summing reach overcounts dedup overlap — accepted approximation
    purchases = 0,
    revenue = 0, // Σ(roas · spend), to recompute blended ROAS
    plays3s = 0,
    thruplays = 0,
    p25 = 0,
    p50 = 0,
    p75 = 0,
    p100 = 0,
    watchWeighted = 0, // Σ(avgWatchSec · plays3s), to weight avg watch time
    reactions = 0,
    comments = 0,
    shares = 0,
    saves = 0,
    postEngagement = 0;

  for (const r of rows) {
    const m = insightMetrics(r);
    const v = videoMetrics(r);
    const e = engagementMetrics(r);
    spend += m.spend;
    impressions += m.impressions;
    clicks += m.clicks;
    reach += m.reach;
    purchases += m.purchases;
    revenue += m.roas * m.spend;
    plays3s += v.plays3s;
    thruplays += v.thruplays;
    p25 += v.p25;
    p50 += v.p50;
    p75 += v.p75;
    p100 += v.p100;
    watchWeighted += v.avgWatchSec * v.plays3s;
    reactions += e.reactions;
    comments += e.comments;
    shares += e.shares;
    saves += e.saves;
    postEngagement += e.postEngagement;
  }

  const cpPurchase = div(spend, purchases);
  return {
    spend,
    impressions,
    clicks,
    ctr: div(clicks, impressions) * 100,
    cpm: div(spend, impressions) * 1000,
    reach,
    frequency: div(impressions, reach),
    roas: div(revenue, spend),
    purchases,
    cpa: cpPurchase,
    cpp: cpPurchase,
    cpr: cpPurchase,
    video: {
      plays3s,
      thruplays,
      p25,
      p50,
      p75,
      p100,
      avgWatchSec: div(watchWeighted, plays3s),
      hookRate: div(plays3s, impressions) * 100,
      holdRate: div(thruplays, impressions) * 100,
    },
    engagement: { reactions, comments, shares, saves, postEngagement },
  };
}

/** Split a Meta story id "{page_id}_{post_id}" → parts; null if not splittable. */
export function parseStoryId(storyId?: string): { pageId: string; postId: string } | null {
  if (!storyId) return null;
  const i = storyId.indexOf("_");
  if (i <= 0 || i === storyId.length - 1) return null;
  return { pageId: storyId.slice(0, i), postId: storyId.slice(i + 1) };
}

/** Meta creative object_type → our enum (best-effort). Carousels often arrive as
 *  SHARE with child_attachments and Reels as VIDEO, so those two are best-effort. */
export function toFormat(objectType?: string): PrismaFormat {
  switch ((objectType ?? "").toUpperCase()) {
    case "VIDEO":
      return "VIDEO";
    case "CAROUSEL":
    case "MULTI_SHARE":
      return "CAROUSEL";
    case "SHARE":
    case "PHOTO":
    case "STATUS":
      return "IMAGE";
    default:
      return "IMAGE";
  }
}

/** Meta campaign status → our enum. */
export function toAdStatus(status?: string): "ACTIVE" | "PAUSED" {
  return (status ?? "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "PAUSED";
}

// ---------------- Audience breakdowns ----------------

const zeros = (n: number): number[] => Array.from({ length: n }, () => 0);
const sumArr = (a: number[]): number => a.reduce((s, v) => s + v, 0);

/** Per-ad audience accumulator (impressions per bucket), summed across an ad's rows. */
export interface AdAudience {
  age: number[]; // 6 — AGE_LABELS
  gender: number[]; // 3 — female, male, unknown
  region: Record<string, number>; // region name → impressions
  hour: number[]; // 12 — two-hour buckets
  day: number[]; // 7 — Mon..Sun
}

export const emptyAudience = (): AdAudience => ({
  age: zeros(6),
  gender: zeros(3),
  region: {},
  hour: zeros(12),
  day: zeros(7),
});

// Meta age bracket → AGE_LABELS index (13-17 folded into the 18-24 bucket).
const AGE_INDEX: Record<string, number> = {
  "13-17": 0,
  "18-24": 0,
  "25-34": 1,
  "35-44": 2,
  "45-54": 3,
  "55-64": 4,
  "65+": 5,
};
export const ageIndex = (metaAge: string): number => AGE_INDEX[metaAge.trim()] ?? -1;

/** Meta gender → GENDER_LABELS index (female, male, unknown). */
export function genderIndex(g: string): number {
  const v = g.trim().toLowerCase();
  return v === "female" ? 0 : v === "male" ? 1 : 2;
}

/** Meta hourly label "HH:00:00 - HH:59:59" → two-hour bucket 0..11. -1 if unparseable. */
export function hourBucket12(label: string): number {
  const m = label.match(/^\s*(\d{1,2})/);
  if (!m) return -1;
  const h = parseInt(m[1], 10);
  return h >= 0 && h <= 23 ? Math.floor(h / 2) : -1;
}

/** "YYYY-MM-DD" → weekday index 0=Mon..6=Sun. -1 if unparseable. */
export function weekdayIndexMon(dateStart: string): number {
  const d = new Date(`${dateStart}T00:00:00Z`);
  return isNaN(d.getTime()) ? -1 : (d.getUTCDay() + 6) % 7;
}

/** Fold one ad's audience into an accumulator (in place). */
export function mergeAudience(into: AdAudience, src: AdAudience): void {
  for (let i = 0; i < into.age.length; i++) into.age[i] += src.age[i] ?? 0;
  for (let i = 0; i < into.gender.length; i++) into.gender[i] += src.gender[i] ?? 0;
  for (let i = 0; i < into.hour.length; i++) into.hour[i] += src.hour[i] ?? 0;
  for (let i = 0; i < into.day.length; i++) into.day[i] += src.day[i] ?? 0;
  for (const [k, v] of Object.entries(src.region)) into.region[k] = (into.region[k] ?? 0) + v;
}

// Friendly Thai labels for common Thai regions; falls back to Meta's raw name.
const REGION_TH: Record<string, string> = {
  Bangkok: "กรุงเทพฯ · Bangkok",
  Nonthaburi: "นนทบุรี",
  "Samut Prakan": "สมุทรปราการ",
  "Chiang Mai": "เชียงใหม่ · CM",
  "Chon Buri": "ชลบุรี",
  Chonburi: "ชลบุรี",
  "Khon Kaen": "ขอนแก่น",
  "Nakhon Ratchasima": "นครราชสีมา",
  Songkhla: "สงขลา",
  "Pathum Thani": "ปทุมธานี",
};
export const prettyRegion = (name: string): string => REGION_TH[name] ?? name;

/**
 * Build the display AudienceProfile from a merged accumulator: each dimension is
 * normalized to percentages; province keeps the top-8 regions with labels. Returns
 * null when there is no audience data at all (caller falls back to the mock profile).
 */
export function buildAudienceProfile(a: AdAudience): AudienceProfile | null {
  const ageSum = sumArr(a.age);
  const genderSum = sumArr(a.gender);
  const regionSum = Object.values(a.region).reduce((s, v) => s + v, 0);
  const daySum = sumArr(a.day);
  const hourSum = sumArr(a.hour);
  if (!(ageSum || genderSum || regionSum || daySum || hourSum)) return null;
  const pct = (v: number, denom: number): number => (denom ? Math.round((v / denom) * 1000) / 10 : 0);
  const topRegions = Object.entries(a.region)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8);
  return {
    age: a.age.map((v) => pct(v, ageSum)),
    gender: a.gender.map((v) => pct(v, genderSum)),
    province: topRegions.map(([, v]) => pct(v, regionSum)),
    provinceLabels: topRegions.map(([name]) => prettyRegion(name)),
    day: a.day.map((v) => pct(v, daySum)),
    hour: a.hour.map((v) => pct(v, hourSum)),
  };
}
