/**
 * Per-ad audience breakdowns (age, gender, region/province, hour-of-day, day-of-week)
 * for one account, in a few level=ad insight calls, keyed by ad_id. Each dimension is
 * best-effort — a failed breakdown leaves that dimension empty rather than aborting.
 * The creative pass folds these per creative (mergeAudience) → AudienceProfile. Server-only.
 */
import { graphGetAll } from "./client";
import {
  ageIndex,
  genderIndex,
  hourBucket12,
  weekdayIndexMon,
  emptyAudience,
  type AdAudience,
} from "./map";

const n = (s?: string): number => (s ? parseFloat(s) : 0);
// Shared insight query: ad level, last 30d, only ad_id + impressions (breakdown
// fields come back automatically). 500/page, paged by graphGetAll.
const BASE = { level: "ad", date_preset: "last_30d", fields: "ad_id,impressions", limit: 500 } as const;

export async function fetchAudience(actId: string, token: string): Promise<Map<string, AdAudience>> {
  const out = new Map<string, AdAudience>();
  const path = `/${actId}/insights`;
  const ensure = (adId: string): AdAudience => {
    let a = out.get(adId);
    if (!a) {
      a = emptyAudience();
      out.set(adId, a);
    }
    return a;
  };

  // age + gender — one call, marginalize each dimension
  try {
    type R = { ad_id?: string; age?: string; gender?: string; impressions?: string };
    for (const r of await graphGetAll<R>(path, { ...BASE, breakdowns: "age,gender" }, token)) {
      if (!r.ad_id) continue;
      const a = ensure(r.ad_id);
      const impr = n(r.impressions);
      const ai = ageIndex(r.age ?? "");
      if (ai >= 0) a.age[ai] += impr;
      a.gender[genderIndex(r.gender ?? "")] += impr;
    }
  } catch {
    /* age/gender breakdown unavailable */
  }

  // region (province)
  try {
    type R = { ad_id?: string; region?: string; impressions?: string };
    for (const r of await graphGetAll<R>(path, { ...BASE, breakdowns: "region" }, token)) {
      if (!r.ad_id || !r.region) continue;
      const a = ensure(r.ad_id);
      a.region[r.region] = (a.region[r.region] ?? 0) + n(r.impressions);
    }
  } catch {
    /* region breakdown unavailable */
  }

  // hour of day (audience time zone)
  try {
    type R = { ad_id?: string; hourly_stats_aggregated_by_audience_time_zone?: string; impressions?: string };
    for (const r of await graphGetAll<R>(
      path,
      { ...BASE, breakdowns: "hourly_stats_aggregated_by_audience_time_zone" },
      token,
    )) {
      if (!r.ad_id) continue;
      const b = hourBucket12(r.hourly_stats_aggregated_by_audience_time_zone ?? "");
      if (b >= 0) ensure(r.ad_id).hour[b] += n(r.impressions);
    }
  } catch {
    /* hourly breakdown unavailable */
  }

  // day of week — daily increment (no breakdown), weekday derived from date_start
  try {
    type R = { ad_id?: string; date_start?: string; impressions?: string };
    for (const r of await graphGetAll<R>(path, { ...BASE, time_increment: 1 }, token)) {
      if (!r.ad_id || !r.date_start) continue;
      const d = weekdayIndexMon(r.date_start);
      if (d >= 0) ensure(r.ad_id).day[d] += n(r.impressions);
    }
  } catch {
    /* daily series unavailable */
  }

  return out;
}
