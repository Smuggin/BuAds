/**
 * The KPI engine — the heart of AdsHub. Pure, framework-agnostic, unit-tested.
 * Spec: .ai/kpi-engine.md. Verdicts are computed here, never stored on entities,
 * so editing a threshold live-re-judges every campaign for free.
 */
import type {
  AudienceProfile,
  Creative,
  Metrics,
  MetricKey,
  ProfileKey,
  Thresholds,
  Verdict,
} from "@/data/types";
import { MARKED_ROAS_MULTIPLIER, METRIC_DEFS } from "./constants";
import { fmtMetric, PERF_COLORS } from "./format";

export interface MetricCellResult {
  key: MetricKey;
  value: number;
  disp: string;
  ok: boolean;
  enforced: boolean; // false when the product skips this metric (exception)
}

export interface EvalResult {
  cells: MetricCellResult[];
  breaches: number;
  passAll: boolean;
  verdict: Verdict;
}

/** Judge a campaign's measured metrics against a product's thresholds. `skip`
 *  lists metrics the product excludes from judging (exceptions) — those never
 *  count as a breach, though their cells are still returned for display. */
export function evalCampaign(
  metrics: Metrics,
  thresholds: Thresholds,
  skip: MetricKey[] = [],
): EvalResult {
  const cells = METRIC_DEFS.map((m): MetricCellResult => {
    const value = metrics[m.key];
    const ok = m.dir === "min" ? value >= thresholds[m.key] : value <= thresholds[m.key];
    return { key: m.key, value, disp: fmtMetric(m.key, value), ok, enforced: !skip.includes(m.key) };
  });
  const breaches = cells.filter((c) => c.enforced && !c.ok).length;
  const passAll = breaches === 0;
  const marked =
    passAll && !skip.includes("roas") && metrics.roas >= thresholds.roas * MARKED_ROAS_MULTIPLIER;
  const verdict: Verdict = marked ? "marked" : passAll ? "running" : "breach";
  return { cells, breaches, passAll, verdict };
}

export interface VerdictMeta {
  label: string;
  icon: string;
  color: string;
}

export function verdictMeta(verdict: Verdict): VerdictMeta {
  if (verdict === "marked") return { label: "น่าสนใจ", icon: "★", color: PERF_COLORS.success };
  if (verdict === "running") return { label: "กำลังรัน", icon: "●", color: "#6b7280" };
  return { label: "เกินเกณฑ์", icon: "⚠", color: PERF_COLORS.danger };
}

export interface CampaignState {
  shouldClose: boolean; // KPI says close, but it's still running in Meta (advisory)
  defaultOn: boolean;
  on: boolean;
  statusLabel: string;
  statusColor: string;
  statusIcon: string;
}

/**
 * Resolve a campaign's open/closed state and status chip.
 *
 * On/off MIRRORS the real Meta status (`metaActive`, synced from the API — same as
 * Meta Business Suite); a user override wins over it. The KPI verdict no longer
 * forces the toggle off (the sync is read-only and never pauses Meta) — instead a
 * breaching, still-running campaign is flagged "ควรปิด" so the team can act.
 */
export function resolveCampaignState(
  verdict: Verdict,
  advise: boolean, // close policy is active (SUGGEST or AUTO, i.e. not OFF)
  override: boolean | undefined,
  metaActive: boolean,
): CampaignState {
  const defaultOn = metaActive;
  const on = override ?? defaultOn;
  const shouldClose = on && verdict === "breach" && advise;
  const vm = verdictMeta(verdict);
  return {
    shouldClose,
    defaultOn,
    on,
    statusLabel: !on ? "ปิดอยู่" : shouldClose ? "ควรปิด" : vm.label,
    statusColor: !on ? "#6b7280" : shouldClose ? PERF_COLORS.danger : vm.color,
    statusIcon: !on ? "⏸" : shouldClose ? "⚠" : vm.icon,
  };
}

export type CreativeVerdict = "marked" | "ok" | "poor";

export interface RankedCreative {
  creative: Creative;
  rank: number; // 1-based, ROAS-desc
  verdict: CreativeVerdict;
  defaultOn: boolean;
  on: boolean;
}

export interface CreativeRanking {
  ranked: RankedCreative[];
  openCount: number;
}

/**
 * Rank a campaign's creatives by ROAS desc and judge each. NOTE: creative verdict
 * uses only 3 metrics (roas/ctr/cpa), per the prototype — intentional.
 */
export function rankCreatives(
  creatives: Creative[],
  thresholds: Thresholds,
  openOverrides: Record<string, boolean> = {},
): CreativeRanking {
  const ranked = [...creatives]
    .sort((a, b) => b.roas - a.roas)
    .map((creative, i): RankedCreative => {
      const pass =
        creative.roas >= thresholds.roas &&
        creative.ctr >= thresholds.ctr &&
        creative.cpa <= thresholds.cpa;
      const strong = pass && creative.roas >= thresholds.roas * MARKED_ROAS_MULTIPLIER;
      const verdict: CreativeVerdict = strong ? "marked" : pass ? "ok" : "poor";
      // Reflect the creative's REAL Meta on/off when known (synced ad status);
      // fall back to the KPI recommendation only when status is unavailable
      // (mock data / never-delivered creatives).
      const defaultOn =
        creative.adStatus != null ? creative.adStatus === "ACTIVE" : verdict !== "poor";
      const on = openOverrides[creative.id] ?? defaultOn;
      return { creative, rank: i + 1, verdict, defaultOn, on };
    });
  const openCount = ranked.filter((r) => r.on).length;
  return { ranked, openCount };
}

const PROFILE_KEYS = ["age", "gender", "province", "day", "hour"] as const;

/** Spend-weighted average of creatives' audience profiles (per-campaign / per-creative). */
export function aggregateProfile(
  creatives: Pick<Creative, "profileKey" | "spend">[],
  profiles: Record<ProfileKey, AudienceProfile>,
): AudienceProfile {
  const acc: AudienceProfile = { age: [], gender: [], province: [], day: [], hour: [] };
  let totalW = 0;
  for (const cr of creatives) {
    const P = profiles[cr.profileKey];
    const w = cr.spend || 1;
    totalW += w;
    for (const k of PROFILE_KEYS) {
      if (acc[k].length === 0) acc[k] = P[k].map(() => 0);
      P[k].forEach((v, i) => {
        acc[k][i] += v * w;
      });
    }
  }
  const div = totalW || 1;
  for (const k of PROFILE_KEYS) acc[k] = acc[k].map((v) => v / div);
  return acc;
}

/** Quick-increase budget by a percentage, snapped to the nearest ฿10. */
export function scaleBudgetByPct(current: number, pct: number): number {
  return Math.max(0, Math.round((current * (1 + pct / 100)) / 10) * 10);
}

export interface BudgetSummary {
  diff: number;
  pct: number;
  monthly: number;
  util: number; // % of new budget used by current daily cost, capped 999
}

export function budgetSummary(
  current: number,
  draft: number,
  costPerDay: number,
): BudgetSummary {
  const diff = draft - current;
  const pct = current ? (diff / current) * 100 : 0;
  const monthly = draft * 30;
  const util = draft ? Math.min(999, Math.round((costPerDay / draft) * 100)) : 0;
  return { diff, pct, monthly, util };
}
