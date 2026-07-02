import { describe, it, expect } from "vitest";
import {
  buildCampaignGroups,
  pinnedActionGroups,
  shouldCloseGroup,
  type BuildParams,
} from "./campaigns";
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
  prodScale: {},
  closeOverride: {},
  skipOverride: {},
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

  it("summary buckets (scale+marked+running+breach+closed) partition all campaigns", () => {
    const { summary } = buildCampaignGroups(base());
    expect(
      summary.scale + summary.marked + summary.running + summary.breach + summary.closed,
    ).toBe(CAMPAIGNS.length);
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
      expect(r.state.shouldClose).toBe(true); // SUN-50 SUGGEST + still ACTIVE in Meta
      expect(r.state.on).toBe(true); // mirrors Meta status; read-only sync never pauses
    }
  });

  it("shouldCloseGroup lists breaching active campaigns, and is empty when product mode is OFF", () => {
    const breach = { prodThr: { "SUN-50": { roas: 9 } } };
    const withSuggest = buildCampaignGroups(base(breach));
    const grp = shouldCloseGroup(withSuggest.groups);
    expect(grp).not.toBeNull();
    expect(grp!.rows.every((r) => r.state.shouldClose)).toBe(true);
    expect(grp!.rows.some((r) => r.campaign.sku === "SUN-50")).toBe(true);

    // setting SUN-50 to OFF removes its campaigns from the should-close advisory
    const off = buildCampaignGroups(base({ ...breach, closeOverride: { "SUN-50": "OFF" } }));
    const grpOff = shouldCloseGroup(off.groups);
    expect((grpOff?.rows ?? []).some((r) => r.campaign.sku === "SUN-50")).toBe(false);
  });
});

describe("filters", () => {
  const F = { status: [], onOff: [], skus: [], close: [], query: "" };

  it("no filters (empty arrays) = everything shown, total === shown", () => {
    const { total, shown } = buildCampaignGroups(base({ filters: F }));
    expect(total).toBe(CAMPAIGNS.length);
    expect(shown).toBe(CAMPAIGNS.length);
  });

  it("summary stays a total even when filtered (counts don't shrink)", () => {
    const onlyOff = buildCampaignGroups(base({ filters: { ...F, onOff: ["off"] } }));
    const all = buildCampaignGroups(base());
    expect(onlyOff.summary).toEqual(all.summary);
    expect(onlyOff.shown).toBeLessThanOrEqual(onlyOff.total);
  });

  it("on/off filter narrows to matching state only", () => {
    const on = buildCampaignGroups(base({ groupBy: "none", filters: { ...F, onOff: ["on"] } }));
    expect(on.groups[0].rows.every((r) => r.state.on)).toBe(true);
    expect(on.shown).toBe(on.groups[0].rows.length);

    const off = buildCampaignGroups(base({ groupBy: "none", filters: { ...F, onOff: ["off"] } }));
    expect(off.groups[0].rows.every((r) => !r.state.on)).toBe(true);
  });

  it("status filter matches verdict; combined dimensions intersect (AND)", () => {
    const breach = buildCampaignGroups(
      base({ groupBy: "none", filters: { ...F, status: ["breach"], onOff: ["on"] } }),
    );
    for (const r of breach.groups[0]?.rows ?? []) {
      expect(r.evalResult.verdict).toBe("breach");
      expect(r.state.on).toBe(true);
    }
  });

  it("sku filter restricts rows to the chosen products", () => {
    const sku = CAMPAIGNS[0].sku;
    const { groups, shown } = buildCampaignGroups(
      base({ groupBy: "none", filters: { ...F, skus: [sku] } }),
    );
    expect(groups[0].rows.every((r) => r.product?.sku === sku)).toBe(true);
    expect(shown).toBe(CAMPAIGNS.filter((c) => c.sku === sku).length);
  });

  it("name query is a case-insensitive substring match", () => {
    const name = CAMPAIGNS[0].name;
    const frag = name.slice(0, 4).toUpperCase();
    const { groups } = buildCampaignGroups(
      base({ groupBy: "none", filters: { ...F, query: frag } }),
    );
    expect(groups[0].rows.every((r) => r.campaign.name.toLowerCase().includes(frag.toLowerCase()))).toBe(
      true,
    );
  });

  it("empty result: filters matching nothing yield shown === 0 and no groups", () => {
    const { groups, shown } = buildCampaignGroups(
      base({ filters: { ...F, query: "___no_such_campaign___" } }),
    );
    expect(shown).toBe(0);
    expect(groups).toHaveLength(0);
  });
});

describe("groupBy: status", () => {
  it("buckets rows by verdict/paused, ordered scale→interesting→running→breach→paused", () => {
    const { groups } = buildCampaignGroups(base({ groupBy: "status" }));
    const order = ["scale", "interesting", "running", "breach", "paused"];
    const keys = groups.map((g) => g.key.replace(/^__status_|__$/g, ""));
    // keys appear in canonical order (a subset, but never out of order)
    const idx = keys.map((k) => order.indexOf(k));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    // every group's rows belong to its bucket
    for (const g of groups) {
      const bucket = g.key.replace(/^__status_|__$/g, "");
      for (const r of g.rows) {
        const rb = r.state.on ? r.evalResult.verdict : "paused";
        expect(rb).toBe(bucket);
      }
    }
  });

  it("status groups cover exactly the shown rows", () => {
    const { groups, shown } = buildCampaignGroups(base({ groupBy: "status" }));
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(shown);
  });
});

describe("pinnedActionGroups", () => {
  const breach = { prodThr: { "SUN-50": { roas: 9 } } };

  it("in 'none' view pins scale/interesting/should-close/breach-off, ordered best→worst", () => {
    const { groups } = buildCampaignGroups(base({ ...breach, groupBy: "none" }));
    const pinned = pinnedActionGroups(groups, "none");
    const keys = pinned.map((g) => g.key);
    // every pinned group is a synthetic action group and non-empty
    expect(pinned.every((g) => g.count > 0)).toBe(true);
    const allowed = ["__should_scale__", "__interesting__", "__should_close__", "__breach_open__"];
    expect(keys.every((k) => allowed.includes(k))).toBe(true);
    // order follows the allowed ladder
    const idx = keys.map((k) => allowed.indexOf(k));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it("scale group holds only shouldScale rows; interesting only on+interesting rows", () => {
    const { groups } = buildCampaignGroups(base({ groupBy: "none" }));
    const pinned = pinnedActionGroups(groups, "none");
    const scale = pinned.find((g) => g.key === "__should_scale__");
    if (scale) expect(scale.rows.every((r) => r.state.shouldScale)).toBe(true);
    const interesting = pinned.find((g) => g.key === "__interesting__");
    if (interesting)
      expect(
        interesting.rows.every((r) => r.state.on && r.evalResult.verdict === "interesting"),
      ).toBe(true);
  });

  it("pins the action groups in product view too, but only ควรปิด in status view", () => {
    const prod = pinnedActionGroups(
      buildCampaignGroups(base({ ...breach, groupBy: "product" })).groups,
      "product",
    );
    // product view surfaces the extras (not just should-close)
    expect(prod.some((g) => g.key !== "__should_close__")).toBe(true);

    // status view already breaks out the buckets, so only the ควรปิด advisory pins
    const status = pinnedActionGroups(
      buildCampaignGroups(base({ ...breach, groupBy: "status" })).groups,
      "status",
    );
    expect(status.every((g) => g.key === "__should_close__")).toBe(true);
  });

  it("breach-off group = breaching + running with close policy OFF", () => {
    const { groups } = buildCampaignGroups(
      base({ ...breach, groupBy: "none", closeOverride: { "SUN-50": "OFF" } }),
    );
    const pinned = pinnedActionGroups(groups, "none");
    const off = pinned.find((g) => g.key === "__breach_open__");
    expect(off).toBeDefined();
    expect(
      off!.rows.every(
        (r) => r.state.on && r.evalResult.verdict === "breach" && !r.state.shouldClose,
      ),
    ).toBe(true);
    // and none of these appear in the should-close advisory
    expect(pinned.some((g) => g.key === "__should_close__" && g.rows.some((r) => r.campaign.sku === "SUN-50"))).toBe(false);
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
