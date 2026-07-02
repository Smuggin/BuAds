import { describe, it, expect } from "vitest";
import { fmtMoney, fmtMetric, fmtK, round1, dirSymbol, roasColor, PERF_COLORS } from "./format";

describe("formatters", () => {
  it("fmtMoney: ฿ + grouped thousands, 2 decimals (1:1 with Business Suite)", () => {
    expect(fmtMoney(1600)).toBe("฿1,600.00");
    expect(fmtMoney(284500)).toBe("฿284,500.00");
    expect(fmtMoney(4745.56)).toBe("฿4,745.56");
    expect(fmtMoney(95.324)).toBe("฿95.32");
    expect(fmtMoney(0)).toBe("฿0.00");
  });

  it("fmtMetric: roas → N.NNx, ctr → N.NN%, money metrics → ฿N.NN", () => {
    expect(fmtMetric("roas", 4.64)).toBe("4.64x");
    expect(fmtMetric("roas", 4.6)).toBe("4.60x");
    expect(fmtMetric("ctr", 1.82)).toBe("1.82%");
    expect(fmtMetric("cpa", 90)).toBe("฿90.00");
    expect(fmtMetric("cost", 1600)).toBe("฿1,600.00");
  });

  it("round1 / fmtK", () => {
    expect(round1(6.84)).toBe(6.8);
    expect(fmtK(412000)).toBe("412K");
    expect(fmtK(1000)).toBe("1K");
    expect(fmtK(999)).toBe("999");
  });

  it("dirSymbol maps direction to ≥ / ≤", () => {
    expect(dirSymbol("min")).toBe("≥");
    expect(dirSymbol("max")).toBe("≤");
  });

  it("roasColor thresholds, and ink when colorByPerformance is off", () => {
    expect(roasColor(5.2)).toBe(PERF_COLORS.success);
    expect(roasColor(4.2)).toBe(PERF_COLORS.ink);
    expect(roasColor(3.1)).toBe(PERF_COLORS.warn);
    expect(roasColor(2.0)).toBe(PERF_COLORS.danger);
    expect(roasColor(2.0, false)).toBe(PERF_COLORS.ink);
  });
});
