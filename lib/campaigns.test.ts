import { describe, it, expect } from "vitest";
import { buildCampaignGroups, type BuildParams } from "./campaigns";
import { firstSortDir } from "./constants";
import { CAMPAIGNS } from "@/data/campaigns";
import { PRODUCTS } from "@/data/products";

const base = (over: Partial<BuildParams> = {}): BuildParams => ({
  campaigns: CAMPAIGNS,
  products: PRODUCTS,
  groupBy: "product",
  groupSort: "perf",
  groupDir: "desc",
  campSort: "status",
  campDir: "desc",
  prodThr: {},
  autoOverride: {},
  budgetOverride: {},
  campOverride: {},
  ...over,
});

describe("buildCampaignGroups", () => {
  it("groups by product, one group per product, rows match sku", () => {
    const { groups } = buildCampaignGroups(base());
    expect(groups).toHaveLength(PRODUCTS.length);
    for (const g of groups) {
      expect(g.rows.every((r) => r.product?.sku === g.key)).toBe(true);
    }
  });

  it("summary marked+running+closed equals total campaigns", () => {
    const { summary } = buildCampaignGroups(base());
    expect(summary.marked + summary.running + summary.closed).toBe(CAMPAIGNS.length);
  });

  it("none grouping yields a single group with all rows", () => {
    const { groups } = buildCampaignGroups(base({ groupBy: "none" }));
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(CAMPAIGNS.length);
  });

  it("sorts rows by a metric (ROAS desc = best first)", () => {
    const { groups } = buildCampaignGroups(base({ groupBy: "none", campSort: "roas", campDir: "desc" }));
    const roas = groups[0].rows.map((r) => r.campaign.metrics.roas);
    expect(roas).toEqual([...roas].sort((a, b) => b - a));
  });

  it("threshold edit re-judges: raising SUN-50 ROAS floor breaches + flags for close (still running in Meta)", () => {
    const { groups } = buildCampaignGroups(base({ prodThr: { "SUN-50": { roas: 9 } } }));
    const sun = groups.find((g) => g.key === "SUN-50")!;
    expect(sun.rows.length).toBeGreaterThan(0);
    for (const r of sun.rows) {
      expect(r.evalResult.verdict).toBe("breach");
      expect(r.state.shouldClose).toBe(true); // SUN-50 autoClose on + still ACTIVE in Meta
      expect(r.state.on).toBe(true); // mirrors Meta status; read-only sync never pauses
    }
  });
});

describe("firstSortDir — best-first first click", () => {
  it("name asc, status/open/budget desc, min-metric desc, max-metric asc", () => {
    expect(firstSortDir("name")).toBe("asc");
    expect(firstSortDir("status")).toBe("desc");
    expect(firstSortDir("budget")).toBe("desc");
    expect(firstSortDir("roas")).toBe("desc"); // min → higher first
    expect(firstSortDir("cpa")).toBe("asc"); // max → lower first
  });
});
