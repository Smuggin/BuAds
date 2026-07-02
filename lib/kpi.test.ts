import { describe, it, expect } from "vitest";
import {
  evalCampaign,
  resolveCampaignState,
  rankCreatives,
  aggregateProfile,
  scaleBudgetByPct,
  budgetSummary,
} from "./kpi";
import { CAMPAIGNS } from "@/data/campaigns";
import { PRODUCTS } from "@/data/products";
import { CREATIVES } from "@/data/creatives";
import { CREATIVE_PROFILES } from "@/data/profiles";
import type { Metrics, ScaleThresholds, Thresholds } from "@/data/types";

const bySku = (sku: string) => PRODUCTS.find((p) => p.sku === sku)!;
const byId = (id: string) => CAMPAIGNS.find((c) => c.id === id)!;

// A limit set + a tougher scale set for the 4 judged metrics.
const THR: Thresholds = { roas: 4, ctr: 1, cpa: 100, cpm: 100, cpp: 150, cpr: 100, cost: 1000 };
const SCALE: ScaleThresholds = { roas: 5, ctr: 2, cpm: 70, cpp: 100 };

describe("evalCampaign — verdicts", () => {
  it("running: passes all limits, no scale target reached", () => {
    const m: Metrics = { roas: 4.2, ctr: 1.5, cpa: 10, cpm: 90, cpp: 140, cpr: 10, cost: 10 };
    const r = evalCampaign(m, THR, [], SCALE);
    expect(r.passAll).toBe(true);
    expect(r.scaleReached).toBe(0);
    expect(r.verdict).toBe("running");
  });

  it("scale: every judged metric reaches its scale target → ควรสเกล", () => {
    const m: Metrics = { roas: 6, ctr: 3, cpa: 10, cpm: 60, cpp: 90, cpr: 10, cost: 9999 };
    const r = evalCampaign(m, THR, [], SCALE);
    expect(r.scaleReached).toBe(4);
    expect(r.verdict).toBe("scale");
    // the scale-zone tier is reflected on the cell
    expect(r.cells.find((c) => c.key === "roas")!.tier).toBe("scale");
  });

  it("interesting: passes all limits, some (not all) reach scale → น่าสนใจ", () => {
    // roas & cpm reach scale; ctr & cpp only clear the limit (mixed signals)
    const m: Metrics = { roas: 6, ctr: 1.5, cpa: 10, cpm: 60, cpp: 140, cpr: 10, cost: 10 };
    const r = evalCampaign(m, THR, [], SCALE);
    expect(r.passAll).toBe(true);
    expect(r.scaleReached).toBe(2);
    expect(r.verdict).toBe("interesting");
  });

  it("breach WINS over a scale-zone metric (ควรปิด beats น่าสนใจ)", () => {
    // ctr breaches its limit while roas/cpm sit in the scale zone
    const m: Metrics = { roas: 10, ctr: 0.5, cpa: 10, cpm: 60, cpp: 90, cpr: 10, cost: 10 };
    const r = evalCampaign(m, THR, [], SCALE);
    expect(r.breaches).toBe(1);
    expect(r.verdict).toBe("breach");
  });

  it("no scaleThresholds → can only be running or breach (never scale/interesting)", () => {
    const m: Metrics = { roas: 10, ctr: 5, cpa: 10, cpm: 10, cpp: 10, cpr: 10, cost: 10 };
    expect(evalCampaign(m, THR).verdict).toBe("running");
  });

  it("breach: counts every failing JUDGED metric (k6 vs NGT-09 → roas/ctr/cpm/cpp fail)", () => {
    const r = evalCampaign(byId("k6").metrics, bySku("NGT-09").thresholds);
    expect(r.breaches).toBe(4); // only the 4 configured KPIs are judged (cpa & cost are not)
    expect(r.verdict).toBe("breach");
  });

  it("cpa & cost are reference-only: passing all 4 KPIs is NOT breach even if cpa/cost fail", () => {
    // cpp 67 ≤ 70 (passes) while cpa & cost blow past their thresholds — must not read breach.
    const metrics: Metrics = { roas: 5, ctr: 2, cpa: 9999, cpm: 80, cpp: 67, cpr: 40, cost: 9999 };
    const thr: Thresholds = { roas: 4, ctr: 1, cpa: 100, cpm: 100, cpp: 70, cpr: 100, cost: 1000 };
    const r = evalCampaign(metrics, thr);
    expect(r.breaches).toBe(0);
    expect(r.verdict).toBe("running"); // no scale targets passed → running (not breach)
    expect(r.cells.find((c) => c.key === "cpa")!.enforced).toBe(false);
    expect(r.cells.find((c) => c.key === "cost")!.enforced).toBe(false);
    expect(r.cells.find((c) => c.key === "cpp")!.enforced).toBe(true);
  });

  it("editing a threshold live re-judges the same campaign", () => {
    const base = bySku("SUN-50").thresholds;
    expect(evalCampaign(byId("k4").metrics, base).verdict).toBe("running");
    // raise the ROAS floor above k4's 4.2 → it now breaches
    expect(evalCampaign(byId("k4").metrics, { ...base, roas: 4.3 }).verdict).toBe("breach");
  });
});

describe("evalCampaign — skip metrics (per-product exceptions)", () => {
  it("a breach only on a skipped metric no longer counts", () => {
    const metrics: Metrics = { roas: 10, ctr: 5, cpa: 10, cpm: 9999, cpp: 10, cpr: 10, cost: 10 };
    expect(evalCampaign(metrics, THR).verdict).toBe("breach"); // cpm fails
    const r = evalCampaign(metrics, THR, ["cpm"]);
    expect(r.breaches).toBe(0);
    expect(r.verdict).toBe("running"); // rest pass, no scale targets provided
    expect(r.cells.find((c) => c.key === "cpm")!.enforced).toBe(false);
    expect(r.cells.find((c) => c.key === "roas")!.enforced).toBe(true);
  });

  it("an enforced metric still breaches even when another is skipped", () => {
    const m: Metrics = { roas: 10, ctr: 5, cpa: 10, cpm: 9999, cpp: 9999, cpr: 10, cost: 100 };
    const r = evalCampaign(m, THR, ["cpm"]); // cpp still enforced and fails
    expect(r.breaches).toBe(1);
    expect(r.verdict).toBe("breach");
  });

  it("a skipped metric is dropped from the scale requirement → the rest can hit ควรสเกล", () => {
    // cpp only clears the limit (not scale); skipping it lets the other 3 carry the campaign to scale
    const m: Metrics = { roas: 6, ctr: 3, cpa: 10, cpm: 60, cpp: 140, cpr: 10, cost: 10 };
    expect(evalCampaign(m, THR, [], SCALE).verdict).toBe("interesting");
    expect(evalCampaign(m, THR, ["cpp"], SCALE).verdict).toBe("scale");
  });
});

describe("resolveCampaignState — on/off mirrors Meta, KPI is advisory", () => {
  it("active in Meta → ON even when breaching; flagged ควรปิด", () => {
    const s = resolveCampaignState("breach", true, undefined, true);
    expect(s.on).toBe(true);
    expect(s.shouldClose).toBe(true);
    expect(s.statusLabel).toBe("ควรปิด");
  });

  it("scale verdict + on → shouldScale, flagged ควรสเกล", () => {
    const s = resolveCampaignState("scale", true, undefined, true);
    expect(s.on).toBe(true);
    expect(s.shouldScale).toBe(true);
    expect(s.shouldClose).toBe(false);
    expect(s.statusLabel).toBe("ควรสเกล");
  });

  it("interesting verdict → น่าสนใจ, not shouldScale", () => {
    const s = resolveCampaignState("interesting", true, undefined, true);
    expect(s.shouldScale).toBe(false);
    expect(s.statusLabel).toBe("น่าสนใจ");
  });

  it("paused in Meta → OFF (ปิดอยู่), regardless of verdict", () => {
    const s = resolveCampaignState("scale", true, undefined, false);
    expect(s.defaultOn).toBe(false);
    expect(s.on).toBe(false);
    expect(s.shouldScale).toBe(false);
    expect(s.statusLabel).toBe("ปิดอยู่");
  });

  it("active + breach + no auto-close → running, flagged เกินเกณฑ์", () => {
    const s = resolveCampaignState("breach", false, undefined, true);
    expect(s.shouldClose).toBe(false);
    expect(s.on).toBe(true);
    expect(s.statusLabel).toBe("เกินเกณฑ์");
  });

  it("user override wins over the Meta default", () => {
    expect(resolveCampaignState("scale", true, false, true).on).toBe(false); // active but toggled off
    expect(resolveCampaignState("breach", true, true, false).on).toBe(true); // paused but toggled on
  });
});

describe("rankCreatives — ROAS desc, 3-metric verdict, openCount", () => {
  const sunCreatives = CREATIVES.filter((c) => c.sku === "SUN-50"); // cr3 4.7, cr4 4.1
  const thr = bySku("SUN-50").thresholds;

  it("sorts ROAS desc and judges ok vs poor (poor defaults OFF)", () => {
    const { ranked, openCount } = rankCreatives(sunCreatives, thr);
    expect(ranked.map((r) => r.creative.id)).toEqual(["cr3", "cr4"]);
    expect(ranked[0].verdict).toBe("ok"); // 4.7 passes, < 1.2× so not marked
    expect(ranked[1].verdict).toBe("poor"); // cr4 ctr 1.5 < 1.6
    expect(ranked[1].defaultOn).toBe(false);
    expect(openCount).toBe(1);
  });

  it("open override flips a poor creative on", () => {
    const { openCount } = rankCreatives(sunCreatives, thr, { cr4: true });
    expect(openCount).toBe(2);
  });
});

describe("aggregateProfile — spend-weighted", () => {
  it("single creative returns its own profile (identity)", () => {
    const cr2 = CREATIVES.find((c) => c.id === "cr2")!; // profile A
    const agg = aggregateProfile([cr2], CREATIVE_PROFILES);
    expect(agg.age).toEqual(CREATIVE_PROFILES.A.age);
  });

  it("heavier-spend creative dominates the blend", () => {
    const heavyA = { profileKey: "A" as const, spend: 100000 };
    const lightB = { profileKey: "B" as const, spend: 100 };
    const agg = aggregateProfile([heavyA, lightB], CREATIVE_PROFILES);
    const a0 = CREATIVE_PROFILES.A.age[0];
    const b0 = CREATIVE_PROFILES.B.age[0];
    expect(Math.abs(agg.age[0] - a0)).toBeLessThan(Math.abs(agg.age[0] - b0));
  });

  it("blend of percentage arrays still sums ≈ 100", () => {
    const agg = aggregateProfile(
      [{ profileKey: "A", spend: 3 }, { profileKey: "C", spend: 7 }],
      CREATIVE_PROFILES,
    );
    const sum = agg.gender.reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });
});

describe("budget math", () => {
  it("scaleBudgetByPct snaps to the nearest ฿10", () => {
    expect(scaleBudgetByPct(1500, 25)).toBe(1880); // 1875 → 1880
    expect(scaleBudgetByPct(600, 100)).toBe(1200);
    expect(scaleBudgetByPct(800, 50)).toBe(1200);
  });

  it("budgetSummary: diff, pct, monthly, util", () => {
    const s = budgetSummary(1500, 1880, 1400);
    expect(s.diff).toBe(380);
    expect(Math.round(s.pct)).toBe(25);
    expect(s.monthly).toBe(56400);
    expect(s.util).toBe(74); // 1400/1880
  });

  it("util caps at 999 and pct is 0 when current is 0", () => {
    expect(budgetSummary(100, 10, 9999).util).toBe(999);
    expect(budgetSummary(0, 500, 100).pct).toBe(0);
  });
});
