/**
 * Account-level audience breakdown for one account + window (age, gender,
 * region/province, hour-of-day, day-of-week). Pulls spend + impressions +
 * purchase_roas per segment so the Breakdown page can show real per-segment ROAS.
 * One Graph call per dimension; each dimension best-effort. Server-only.
 */
import { graphGetAll } from "./client";
import { ageIndex, genderIndex, hourBucket12, weekdayIndexMon } from "./map";
import { emptyBreakdownAccum, type BreakdownAccum, type Seg } from "@/lib/breakdown";
import { timeParams, type TimeSpec } from "@/lib/windows";

const n = (s?: string): number => (s ? parseFloat(s) : 0);
const roasOf = (pr?: { action_type: string; value: string }[]): number =>
  pr && pr.length ? n(pr[0].value) : 0;
const add = (seg: Seg, impr: number, spend: number, rev: number): void => {
  seg.impr += impr;
  seg.spend += spend;
  seg.rev += rev;
};

const FIELDS = "spend,impressions,purchase_roas";

/** @param spec preset window or a custom {since,until} range. */
export async function fetchBreakdown(
  actId: string,
  token: string,
  spec: TimeSpec,
): Promise<BreakdownAccum> {
  const acc = emptyBreakdownAccum();
  const path = `/${actId}/insights`;
  const base = { level: "account", fields: FIELDS, ...timeParams(spec) } as const;

  // age + gender (one call; each row is one age×gender cell → folds into both marginals)
  try {
    type R = {
      age?: string;
      gender?: string;
      spend?: string;
      impressions?: string;
      purchase_roas?: { action_type: string; value: string }[];
    };
    for (const r of await graphGetAll<R>(path, { ...base, breakdowns: "age,gender" }, token)) {
      const spend = n(r.spend);
      const impr = n(r.impressions);
      const rev = spend * roasOf(r.purchase_roas);
      const ai = ageIndex(r.age ?? "");
      if (ai >= 0) add(acc.age[ai], impr, spend, rev);
      add(acc.gender[genderIndex(r.gender ?? "")], impr, spend, rev);
    }
  } catch {
    /* age/gender breakdown unavailable */
  }

  // region (province)
  try {
    type R = {
      region?: string;
      spend?: string;
      impressions?: string;
      purchase_roas?: { action_type: string; value: string }[];
    };
    for (const r of await graphGetAll<R>(path, { ...base, breakdowns: "region" }, token)) {
      if (!r.region) continue;
      const spend = n(r.spend);
      acc.region[r.region] ??= { impr: 0, spend: 0, rev: 0 };
      add(acc.region[r.region], n(r.impressions), spend, spend * roasOf(r.purchase_roas));
    }
  } catch {
    /* region breakdown unavailable */
  }

  // hour of day (audience time zone) — impressions only (heatmap intensity)
  try {
    type R = { hourly_stats_aggregated_by_audience_time_zone?: string; impressions?: string };
    for (const r of await graphGetAll<R>(
      path,
      { ...base, breakdowns: "hourly_stats_aggregated_by_audience_time_zone" },
      token,
    )) {
      const b = hourBucket12(r.hourly_stats_aggregated_by_audience_time_zone ?? "");
      if (b >= 0) acc.hour[b] += n(r.impressions);
    }
  } catch {
    /* hourly breakdown unavailable */
  }

  // day of week + daily spend series — one daily-increment call carries both
  // (base.fields already includes spend). day[] gets weekday impressions for the
  // heatmap; daily{} keeps per-date spend for the Daily-spend chart.
  try {
    type R = {
      date_start?: string;
      impressions?: string;
      spend?: string;
      purchase_roas?: { action_type: string; value: string }[];
    };
    for (const r of await graphGetAll<R>(path, { ...base, time_increment: 1 }, token)) {
      if (!r.date_start) continue;
      const d = weekdayIndexMon(r.date_start);
      if (d >= 0) acc.day[d] += n(r.impressions);
      const spend = n(r.spend);
      acc.daily![r.date_start] = (acc.daily![r.date_start] ?? 0) + spend;
      acc.dailyRev![r.date_start] = (acc.dailyRev![r.date_start] ?? 0) + spend * roasOf(r.purchase_roas);
    }
  } catch {
    /* daily series unavailable */
  }

  return acc;
}
