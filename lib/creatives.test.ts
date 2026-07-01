import { describe, it, expect } from "vitest";
import { groupCreatives, type CreativeGroupInput, type CreativeRaw } from "./creatives";
import type { Creative } from "@/data/types";

const cr = (over: Partial<Creative> = {}): Creative => ({
  id: "c1",
  name: "Creative",
  format: "Image",
  sku: "SUN-50",
  campaigns: [],
  profileKey: "A",
  spend: 0,
  impressions: 0,
  roas: 0,
  ctr: 0,
  cpa: 0,
  purchases: 0,
  frequency: 0,
  ...over,
});

const raw = (over: Partial<CreativeRaw> = {}): CreativeRaw => ({
  spend: 0, impressions: 0, clicks: 0, purchases: 0, reach: 0, revenue: 0, ...over,
});

const input = (over: Partial<CreativeGroupInput>): CreativeGroupInput => ({
  key: "post1",
  creative: cr(),
  raw: raw(),
  campaignIds: [],
  active: false,
  ...over,
});

describe("groupCreatives", () => {
  it("merges members sharing a key and keeps distinct keys separate", () => {
    const out = groupCreatives([
      input({ key: "post1", creative: cr({ id: "a", spend: 10 }), raw: raw({ spend: 10 }) }),
      input({ key: "post1", creative: cr({ id: "b", spend: 20 }), raw: raw({ spend: 20 }) }),
      input({ key: "post2", creative: cr({ id: "c", spend: 5 }), raw: raw({ spend: 5 }) }),
    ]);
    expect(out).toHaveLength(2);
    const g1 = out.find((c) => c.groupSize === 2)!;
    expect(g1.spend).toBe(30);
  });

  it("sums metrics then RECOMPUTES rates (never averages them)", () => {
    // ROAS: (300+300)/(100+300)=1.5, not avg(3,1)=2. CTR: 20/1000=2%, not avg(10%,1%).
    const out = groupCreatives([
      input({ key: "p", creative: cr({ id: "a", spend: 100 }), raw: raw({ spend: 100, revenue: 300, clicks: 10, impressions: 100, purchases: 2, reach: 50 }) }),
      input({ key: "p", creative: cr({ id: "b", spend: 300 }), raw: raw({ spend: 300, revenue: 300, clicks: 10, impressions: 900, purchases: 6, reach: 450 }) }),
    ]);
    expect(out).toHaveLength(1);
    const g = out[0];
    expect(g.roas).toBe(1.5);
    expect(g.ctr).toBe(2);
    expect(g.cpa).toBe(Math.round(400 / 8)); // 50
    expect(g.frequency).toBe(2); // 1000 impr / 500 reach
    expect(g.impressions).toBe(1000);
    expect(g.purchases).toBe(8);
    expect(g.spend).toBe(400);
  });

  it("takes display fields from the highest-spend representative", () => {
    const out = groupCreatives([
      input({ key: "p", creative: cr({ id: "small", name: "Small", spend: 5 }), raw: raw({ spend: 5 }) }),
      input({ key: "p", creative: cr({ id: "big", name: "Big", thumbnailUrl: "t.jpg", spend: 90 }), raw: raw({ spend: 90 }) }),
    ]);
    expect(out[0].id).toBe("big");
    expect(out[0].name).toBe("Big");
    expect(out[0].thumbnailUrl).toBe("t.jpg");
  });

  it("unions campaigns and marks ACTIVE if any member is active", () => {
    const out = groupCreatives([
      input({ key: "p", campaignIds: ["k1", "k2"], active: false }),
      input({ key: "p", campaignIds: ["k2", "k3"], active: true }),
    ]);
    expect(new Set(out[0].campaigns)).toEqual(new Set(["k1", "k2", "k3"]));
    expect(out[0].adStatus).toBe("ACTIVE");
  });

  it("sorts merged entries by spend desc", () => {
    const out = groupCreatives([
      input({ key: "low", raw: raw({ spend: 10 }) }),
      input({ key: "high", raw: raw({ spend: 100 }) }),
      input({ key: "mid", raw: raw({ spend: 50 }) }),
    ]);
    expect(out.map((c) => c.spend)).toEqual([100, 50, 10]);
  });

  it("guards divide-by-zero (no spend/impr/reach → zeroed rates)", () => {
    const out = groupCreatives([input({ key: "p", raw: raw() })]);
    expect(out[0]).toMatchObject({ roas: 0, ctr: 0, cpa: 0, frequency: 0, groupSize: 1 });
  });
});
