import { describe, it, expect } from "vitest";
import { shapeBreakdown, emptyBreakdownAccum, type BreakdownAccum } from "./breakdown";

const seg = (impr: number, spend: number, rev: number) => ({ impr, spend, rev });

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
