/**
 * Pure shaping for the Breakdown page. Folds per-account audience-breakdown
 * accumulators (raw sums of impressions/spend/revenue per segment) into the
 * display shape the BreakdownView renders. Rates (pct, ROAS) are recomputed from
 * the sums — never averaged. Framework-agnostic + unit-tested. No I/O.
 */
import { AGE_LABELS, GENDER_LABELS, GENDER_COLORS, DAY_LABELS } from "@/data/profiles";
import { prettyRegion } from "@/lib/meta/map";
import type { AgeRow, GenderRow, ProvinceRow } from "@/data/overview";

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
});

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
