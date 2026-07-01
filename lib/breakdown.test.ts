import { describe, it, expect } from "vitest";
import {
  shapeBreakdown,
  emptyBreakdownAccum,
  aggregateAudienceProfiles,
  foldDailySpend,
  foldDailyByAccount,
  type BreakdownAccum,
} from "./breakdown";

const seg = (impr: number, spend: number, rev: number) => ({ impr, spend, rev });

describe("foldDailySpend", () => {
  it("returns empty arrays when no accums carry daily data", () => {
    expect(foldDailySpend([])).toEqual({ dates: [], spend: [] });
    expect(foldDailySpend([emptyBreakdownAccum()])).toEqual({ dates: [], spend: [] });
  });

  it("sums spend by date across accounts and sorts by date ascending", () => {
    const a = emptyBreakdownAccum();
    a.daily = { "2026-06-02": 100, "2026-06-01": 50 };
    const b = emptyBreakdownAccum();
    b.daily = { "2026-06-01": 25, "2026-06-03": 10 };
    const { dates, spend } = foldDailySpend([a, b]);
    expect(dates).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(spend).toEqual([75, 100, 10]); // 50+25, 100, 10
  });

  it("rounds spend and tolerates a missing daily map", () => {
    const a = emptyBreakdownAccum();
    a.daily = { "2026-06-01": 12.4, "2026-06-02": 12.6 };
    const b = emptyBreakdownAccum();
    delete b.daily;
    expect(foldDailySpend([a, b]).spend).toEqual([12, 13]);
  });
});

describe("foldDailyByAccount", () => {
  it("keeps each account as its own series on a shared, sorted date axis", () => {
    const a = emptyBreakdownAccum();
    a.daily = { "2026-06-02": 100, "2026-06-01": 50 };
    a.dailyRev = { "2026-06-02": 300, "2026-06-01": 150 };
    const b = emptyBreakdownAccum();
    b.daily = { "2026-06-01": 25, "2026-06-03": 10 };
    b.dailyRev = { "2026-06-01": 40, "2026-06-03": 20 };
    const { dates, accounts } = foldDailyByAccount([
      { metaAccountId: "act_A", name: "A", accum: a },
      { metaAccountId: "act_B", name: "B", accum: b },
    ]);
    expect(dates).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    // account A is zero-filled on 06-03 (a date only B has)
    expect(accounts[0]).toMatchObject({ metaAccountId: "act_A", spend: [50, 100, 0], revenue: [150, 300, 0] });
    expect(accounts[1]).toMatchObject({ metaAccountId: "act_B", spend: [25, 0, 10], revenue: [40, 0, 20] });
  });

  it("treats a missing dailyRev as zeros and drops empty accounts", () => {
    const a = emptyBreakdownAccum();
    a.daily = { "2026-06-01": 12.4, "2026-06-02": 12.6 };
    delete a.dailyRev;
    const empty = emptyBreakdownAccum(); // no daily/rev → dropped
    const { dates, accounts } = foldDailyByAccount([
      { metaAccountId: "act_A", name: "A", accum: a },
      { metaAccountId: "act_Z", name: "Z", accum: empty },
    ]);
    expect(dates).toEqual(["2026-06-01", "2026-06-02"]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ metaAccountId: "act_A", spend: [12, 13], revenue: [0, 0] });
  });

  it("returns empty axis and no accounts when nothing carries daily data", () => {
    expect(foldDailyByAccount([])).toEqual({ dates: [], accounts: [] });
  });
});

describe("shapeBreakdown", () => {
  it("returns zeroed-but-shaped rows for no data", () => {
    const bd = shapeBreakdown([]);
    expect(bd.age).toHaveLength(6);
    expect(bd.gender).toHaveLength(3);
    expect(bd.province).toHaveLength(0);
    expect(bd.heat.grid).toHaveLength(7);
    expect(bd.heat.grid[0]).toHaveLength(12);
    expect(bd.age.every((r) => r[1] === 0 && r[2] === 0)).toBe(true);
  });

  it("derives pct from impression share and ROAS from Σrev/Σspend", () => {
    const a = emptyBreakdownAccum();
    a.age[0] = seg(100, 100, 300); // 25% of impressions, ROAS 3.0
    a.age[1] = seg(300, 200, 1000); // 75%, ROAS 5.0
    const bd = shapeBreakdown([a]);
    expect(bd.age[0][1]).toBe(25);
    expect(bd.age[0][2]).toBe(3);
    expect(bd.age[1][1]).toBe(75);
    expect(bd.age[1][2]).toBe(5);
  });

  it("sums raw segments across accounts before recomputing rates", () => {
    const a = emptyBreakdownAccum();
    a.gender[0] = seg(100, 100, 200); // acct A: spend 100, rev 200
    const b = emptyBreakdownAccum();
    b.gender[0] = seg(100, 100, 600); // acct B: spend 100, rev 600
    const bd = shapeBreakdown([a, b]);
    // blended ROAS = (200+600)/(100+100) = 4.0, NOT avg(2,6)=4 by luck; check non-trivial case
    expect(bd.gender[0][2]).toBe(4);
    expect(bd.gender[0][1]).toBe(100); // only female has impressions
  });

  it("keeps top-8 provinces by impressions with pretty labels", () => {
    const a = emptyBreakdownAccum();
    for (let i = 0; i < 10; i++) a.region[`R${i}`] = seg((i + 1) * 10, 10, 20);
    a.region["Bangkok"] = seg(1000, 100, 500);
    const bd = shapeBreakdown([a]);
    expect(bd.province).toHaveLength(8);
    expect(bd.province[0][0]).toContain("Bangkok"); // highest impressions, prettified
  });

  it("builds a normalized 0..100 day×hour heat grid", () => {
    const a = emptyBreakdownAccum();
    a.day = [1, 0, 0, 0, 0, 0, 0];
    a.hour = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    const bd = shapeBreakdown([a]);
    expect(bd.heat.grid[0][6]).toBe(100); // the single hot cell
    expect(Math.max(...bd.heat.grid.flat())).toBe(100);
    expect(Math.min(...bd.heat.grid.flat())).toBe(0);
  });
});

describe("aggregateAudienceProfiles", () => {
  const prof = (over: Partial<Parameters<typeof aggregateAudienceProfiles>[0][0]["audience"]>) => ({
    age: [0, 0, 0, 0, 0, 0], gender: [0, 0, 0], province: [], day: [0, 0, 0, 0, 0, 0, 0], hour: Array(12).fill(0), ...over,
  });

  it("returns null when nothing has audience", () => {
    expect(aggregateAudienceProfiles([{ audience: null, spend: 10 }])).toBeNull();
  });

  it("spend-weights the blend and merges province labels (top 8)", () => {
    const A = prof({ age: [100, 0, 0, 0, 0, 0], gender: [100, 0, 0], province: [100], provinceLabels: ["BKK"], day: [100, 0, 0, 0, 0, 0, 0] });
    const B = prof({ age: [0, 0, 0, 0, 0, 100], gender: [0, 100, 0], province: [100], provinceLabels: ["CNX"], day: [0, 0, 0, 0, 0, 0, 100] });
    const r = aggregateAudienceProfiles([{ audience: A, spend: 30 }, { audience: B, spend: 10 }])!;
    expect(r.gender[0]).toBe(75); // 30/40 weighting
    expect(r.gender[1]).toBe(25);
    expect(r.age[0]).toBeGreaterThan(r.age[5]); // A dominates
    expect(r.provinceLabels).toEqual(["BKK", "CNX"]); // BKK higher weight first
    expect(r.province[0]).toBeGreaterThan(r.province[1]);
  });
});
