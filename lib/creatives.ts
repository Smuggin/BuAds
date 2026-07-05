/** Pure helpers for the Creatives view: account scoping, filtering, and merging
 *  duplicate ad-creatives (same underlying post) into one entry. Unit-tested. */
import type { AccountKey, Campaign, Creative } from "@/data/types";

export function creativeAccounts(cr: Creative, campaigns: Campaign[]): AccountKey[] {
  const set = new Set<AccountKey>();
  for (const cid of cr.campaigns) {
    const c = campaigns.find((x) => x.id === cid);
    if (c) set.add(c.account);
  }
  return [...set];
}

/** SKUs present in a creatives list (options for the product dropdown). */
export function skusInCreatives(creatives: Creative[]): Set<string> {
  const set = new Set<string>();
  for (const cr of creatives) if (cr.sku) set.add(cr.sku);
  return set;
}

/** Product-only filter (account scoping is applied server-side before this). */
export function filterCreatives(creatives: Creative[], prod: string): Creative[] {
  return creatives.filter((cr) => prod === "all" || cr.sku === prod);
}

/** Raw, summable per-creative metrics for a selected window. Rates are recomputed
 *  from these sums when merging a group — never averaged. */
export interface CreativeRaw {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  reach: number;
  revenue: number; // spend × ROAS
}

export interface CreativeGroupInput {
  key: string; // identity: metaPostId ?? videoId ?? metaCreativeId
  creative: Creative; // representative display fields for this member
  raw: CreativeRaw;
  campaignIds: string[];
  active: boolean; // adStatus === "ACTIVE"
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Merge duplicate ad-creatives that share an identity `key` (one Meta post reused
 * across many ads) into a single Creative. Metrics are summed then rates recomputed
 * (Σrev/Σspend, Σclicks/Σimpr, …). The representative (highest spend) supplies the
 * display fields; campaigns are unioned; adStatus is ACTIVE if any member is.
 * Returned list is sorted by spend desc.
 */
export function groupCreatives(inputs: CreativeGroupInput[]): Creative[] {
  const groups = new Map<string, CreativeGroupInput[]>();
  for (const i of inputs) {
    const g = groups.get(i.key);
    if (g) g.push(i);
    else groups.set(i.key, [i]);
  }

  const out: Creative[] = [];
  for (const members of groups.values()) {
    // representative = highest spend, tie-break by impressions
    const rep = members.reduce((best, m) =>
      m.raw.spend > best.raw.spend ||
      (m.raw.spend === best.raw.spend && m.raw.impressions > best.raw.impressions)
        ? m
        : best,
    );

    const sum: CreativeRaw = { spend: 0, impressions: 0, clicks: 0, purchases: 0, reach: 0, revenue: 0 };
    const campaigns = new Set<string>();
    let active = false;
    for (const m of members) {
      sum.spend += m.raw.spend;
      sum.impressions += m.raw.impressions;
      sum.clicks += m.raw.clicks;
      sum.purchases += m.raw.purchases;
      sum.reach += m.raw.reach;
      sum.revenue += m.raw.revenue;
      for (const c of m.campaignIds) campaigns.add(c);
      if (m.active) active = true;
    }

    const roas = sum.spend ? r2(sum.revenue / sum.spend) : 0;
    const ctr = sum.impressions ? r2((sum.clicks / sum.impressions) * 100) : 0;
    const cpa = sum.purchases ? Math.round(sum.spend / sum.purchases) : 0;
    const frequency = sum.reach ? r2(sum.impressions / sum.reach) : 0;
    const cpm = sum.impressions ? r2((sum.spend / sum.impressions) * 1000) : 0;

    out.push({
      ...rep.creative,
      spend: Math.round(sum.spend),
      impressions: sum.impressions,
      purchases: sum.purchases,
      roas,
      ctr,
      cpa,
      frequency,
      reach: sum.reach,
      cpm,
      revenue: Math.round(sum.revenue),
      adStatus: active ? "ACTIVE" : "PAUSED",
      campaigns: [...campaigns],
      groupSize: members.length,
    });
  }

  return out.sort((a, b) => b.spend - a.spend);
}
