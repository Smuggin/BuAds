/**
 * Pure shaping for the Breakdown page. Folds per-account audience-breakdown
 * accumulators (raw sums of impressions/spend/revenue per segment) into the
 * display shape the BreakdownView renders. Rates (pct, ROAS) are recomputed from
 * the sums — never averaged. Framework-agnostic + unit-tested. No I/O.
 */
import { AGE_LABELS, GENDER_LABELS, GENDER_COLORS, DAY_LABELS } from "@/data/profiles";
import { prettyRegion } from "@/lib/meta/map";
import type { AgeRow, GenderRow, ProvinceRow } from "@/data/overview";
import type { AudienceProfile } from "@/data/types";

/** Raw sums for one segment (audience bucket). */
export interface Seg {
  impr: number;
  spend: number;
  rev: number; // spend × ROAS, to recompute blended per-segment ROAS
}

/** Per-account breakdown accumulator (stored in BreakdownSnapshot.data). Age and
 *  gender are independent marginals; region is keyed by Meta's region name; the
 *  heatmap only needs impression intensity, so hour/day carry impressions only. */
export interface BreakdownAccum {
  age: Seg[]; // 6 — AGE_LABELS
  gender: Seg[]; // 3 — female, male, unknown
  region: Record<string, Seg>;
  hour: number[]; // 12 — two-hour buckets (impressions)
  day: number[]; // 7 — Mon..Sun (impressions)
  daily?: Record<string, number>; // ISO date (YYYY-MM-DD) → spend, over the window
  dailyRev?: Record<string, number>; // ISO date → revenue (spend × ROAS), over the window
  hourlySpend?: number[]; // 24 — spend per hour 0..23 (today only; drives the hourly chart)
  hourlyRev?: number[]; // 24 — revenue per hour 0..23 (today only)
}

/** Per-account daily series, aligned to a shared date axis (see foldDailyByAccount). */
export interface DailyAccountSeries {
  metaAccountId: string;
  name: string;
  spend: number[];
  revenue: number[];
}

export interface BreakdownData {
  age: AgeRow[];
  gender: GenderRow[];
  province: ProvinceRow[];
  heat: { days: string[]; grid: number[][] };
}

const zeros = (n: number): number[] => Array.from({ length: n }, () => 0);
const segs = (n: number): Seg[] => Array.from({ length: n }, () => ({ impr: 0, spend: 0, rev: 0 }));
const addSeg = (into: Seg, s: Seg): void => {
  into.impr += s.impr;
  into.spend += s.spend;
  into.rev += s.rev;
};
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);
const pct = (v: number, denom: number): number => (denom ? Math.round((v / denom) * 1000) / 10 : 0);
const roas = (s: Seg): number => (s.spend ? Math.round((s.rev / s.spend) * 100) / 100 : 0);

export const emptyBreakdownAccum = (): BreakdownAccum => ({
  age: segs(6),
  gender: segs(3),
  region: {},
  hour: zeros(12),
  day: zeros(7),
  daily: {},
  dailyRev: {},
});

/** Merge the per-account daily-spend maps into one date-ordered series.
 *  Returns aligned arrays: dates (YYYY-MM-DD, ascending) + summed spend per date. */
export function foldDailySpend(accums: BreakdownAccum[]): { dates: string[]; spend: number[] } {
  const byDate: Record<string, number> = {};
  for (const a of accums) {
    for (const [date, spend] of Object.entries(a.daily ?? {})) {
      byDate[date] = (byDate[date] ?? 0) + (Number(spend) || 0);
    }
  }
  const dates = Object.keys(byDate).sort();
  return { dates, spend: dates.map((d) => Math.round(byDate[d])) };
}

/** Keep every account's daily spend + revenue as its own series on a shared,
 *  ascending date axis (union of all accounts' dates, zero-filled). Powers the
 *  stacked per-account daily-spend chart + its Spend/Revenue toggle. */
export function foldDailyByAccount(
  rows: { metaAccountId: string; name: string; accum: BreakdownAccum }[],
): { dates: string[]; accounts: DailyAccountSeries[] } {
  const dateSet = new Set<string>();
  for (const r of rows) {
    for (const d of Object.keys(r.accum.daily ?? {})) dateSet.add(d);
    for (const d of Object.keys(r.accum.dailyRev ?? {})) dateSet.add(d);
  }
  const dates = [...dateSet].sort();
  const accounts = rows
    .map((r) => ({
      metaAccountId: r.metaAccountId,
      name: r.name,
      spend: dates.map((d) => Math.round(r.accum.daily?.[d] ?? 0)),
      revenue: dates.map((d) => Math.round(r.accum.dailyRev?.[d] ?? 0)),
    }))
    // drop accounts with no spend AND no revenue across the whole window
    .filter((a) => a.spend.some((v) => v > 0) || a.revenue.some((v) => v > 0));
  return { dates, accounts };
}

/** Keep every account's hourly spend + revenue as its own series on a shared
 *  24-hour axis (00:00..23:00). Powers the stacked chart when the range is "today",
 *  where a single daily bar would be useless. Same shape as foldDailyByAccount so
 *  the chart component renders it unchanged. */
export function foldHourlyByAccount(
  rows: { metaAccountId: string; name: string; accum: BreakdownAccum }[],
): { labels: string[]; accounts: DailyAccountSeries[] } {
  const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  const accounts = rows
    .map((r) => ({
      metaAccountId: r.metaAccountId,
      name: r.name,
      spend: Array.from({ length: 24 }, (_, h) => Math.round(r.accum.hourlySpend?.[h] ?? 0)),
      revenue: Array.from({ length: 24 }, (_, h) => Math.round(r.accum.hourlyRev?.[h] ?? 0)),
    }))
    .filter((a) => a.spend.some((v) => v > 0) || a.revenue.some((v) => v > 0));
  return { labels, accounts };
}

/** Sum many per-account accumulators and derive the display rows. ROAS per segment
 *  is Σrevenue / Σspend (blended); pct is the impression share of the dimension. */
export function shapeBreakdown(accums: BreakdownAccum[]): BreakdownData {
  const age = segs(6);
  const gender = segs(3);
  const region: Record<string, Seg> = {};
  const hour = zeros(12);
  const day = zeros(7);

  for (const a of accums) {
    a.age?.forEach((s, i) => age[i] && addSeg(age[i], s));
    a.gender?.forEach((s, i) => gender[i] && addSeg(gender[i], s));
    for (const [name, s] of Object.entries(a.region ?? {})) {
      region[name] ??= { impr: 0, spend: 0, rev: 0 };
      addSeg(region[name], s);
    }
    a.hour?.forEach((v, i) => (hour[i] += v));
    a.day?.forEach((v, i) => (day[i] += v));
  }

  const ageImpr = sum(age.map((s) => s.impr));
  const genderImpr = sum(gender.map((s) => s.impr));
  const regionEntries = Object.entries(region);
  const regionImpr = sum(regionEntries.map(([, s]) => s.impr));

  const ageRows: AgeRow[] = age.map((s, i) => [AGE_LABELS[i], pct(s.impr, ageImpr), roas(s)]);
  const genderRows: GenderRow[] = gender.map((s, i) => [
    GENDER_LABELS[i],
    pct(s.impr, genderImpr),
    roas(s),
    GENDER_COLORS[i],
  ]);
  const provinceRows: ProvinceRow[] = regionEntries
    .sort((x, y) => y[1].impr - x[1].impr)
    .slice(0, 8)
    .map(([name, s]) => [prettyRegion(name), pct(s.impr, regionImpr), roas(s)]);

  // Heatmap intensity = normalized day × hour outer product, scaled 0..100.
  const dayMax = Math.max(0, ...day);
  const hourMax = Math.max(0, ...hour);
  const dayN = day.map((v) => (dayMax ? v / dayMax : 0));
  const hourN = hour.map((v) => (hourMax ? v / hourMax : 0));
  const cells = dayN.map((d) => hourN.map((h) => d * h));
  const cellMax = Math.max(0, ...cells.flat());
  const grid = cells.map((row) => row.map((c) => (cellMax ? Math.round((c / cellMax) * 100) : 0)));

  return { age: ageRows, gender: genderRows, province: provinceRows, heat: { days: DAY_LABELS, grid } };
}

/**
 * Spend-weighted blend of many per-creative AudienceProfiles into one (for a
 * selected product). age/gender/day/hour are weighted-averaged; province is
 * merged by region label and the top 8 kept. null when nothing has audience.
 */
export function aggregateAudienceProfiles(
  items: { audience: AudienceProfile | null; spend: number }[],
): AudienceProfile | null {
  const valid = items.filter((i) => i.audience);
  if (!valid.length) return null;

  const age = zeros(6), gender = zeros(3), day = zeros(7), hour = zeros(12);
  const region = new Map<string, number>();
  let totalW = 0;
  for (const { audience, spend } of valid) {
    const a = audience!;
    const w = spend > 0 ? spend : 1;
    totalW += w;
    a.age?.forEach((v, i) => (age[i] += (v || 0) * w));
    a.gender?.forEach((v, i) => (gender[i] += (v || 0) * w));
    a.day?.forEach((v, i) => (day[i] += (v || 0) * w));
    a.hour?.forEach((v, i) => (hour[i] += (v || 0) * w));
    a.province?.forEach((v, i) => {
      const label = a.provinceLabels?.[i] ?? `#${i}`;
      region.set(label, (region.get(label) ?? 0) + (v || 0) * w);
    });
  }
  const avg = (arr: number[]) => arr.map((v) => Math.round((v / totalW) * 10) / 10);
  const top = [...region.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  return {
    age: avg(age),
    gender: avg(gender),
    day: avg(day),
    hour: avg(hour),
    province: top.map(([, v]) => Math.round((v / totalW) * 10) / 10),
    provinceLabels: top.map(([l]) => l),
  };
}
