import { describe, expect, it } from "vitest";
import { effScaleThresholds } from "./resolvers";
import { deriveScaleThreshold } from "./constants";
import type { Product, Thresholds } from "@/data/types";

const THRESHOLDS: Thresholds = {
  roas: 4,
  ctr: 1,
  cpa: 200,
  cpm: 80,
  cpp: 120,
  cpr: 0,
  cost: 0,
};

const product = (scaleThresholds: Product["scaleThresholds"]): Product => ({
  sku: "TEST",
  th: "ทดสอบ",
  category: "test",
  accounts: [],
  unitCost: 0,
  img: null,
  thresholds: THRESHOLDS,
  scaleThresholds,
  closeMode: "OFF",
  skipMetrics: [],
});

describe("effScaleThresholds — scale KPI is free of its limit", () => {
  it("keeps a min-metric scale target that sits below its limit (no clamp up)", () => {
    // roas scale 2 is looser than the roas limit 4 → kept as-is, never clamped to 4
    const eff = effScaleThresholds(product({ roas: 2 }));
    expect(eff.roas).toBe(2);
  });

  it("keeps a max-metric scale target that sits above its limit (no clamp down)", () => {
    // cpp scale 200 is looser than the cpp limit 120 → kept as-is, never clamped to 120
    const eff = effScaleThresholds(product({ cpp: 200 }));
    expect(eff.cpp).toBe(200);
  });

  it("leaves a stricter-than-limit scale target untouched", () => {
    const eff = effScaleThresholds(product({ roas: 6, cpp: 90 }));
    expect(eff.roas).toBe(6);
    expect(eff.cpp).toBe(90);
  });

  it("a draft edit below the limit is kept, not clamped", () => {
    const eff = effScaleThresholds(product({}), { TEST: { roas: 1 } });
    expect(eff.roas).toBe(1);
  });

  it("falls back to the derived default when a metric has no scale target", () => {
    const eff = effScaleThresholds(product({}));
    expect(eff.roas).toBe(deriveScaleThreshold("roas", THRESHOLDS.roas));
    expect(eff.cpp).toBe(deriveScaleThreshold("cpp", THRESHOLDS.cpp));
  });
});
