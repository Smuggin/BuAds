/**
 * Map Meta Graph API JSON → our Prisma rows / metric shapes. Pure.
 * Encodes the field→MetricKey mapping + money-unit rules from .ai/meta-integration.md.
 */
import type { CreativeFormat as PrismaFormat } from "@prisma/client";

export interface MetaInsightRow {
  campaign_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  purchase_roas?: { action_type: string; value: string }[];
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

const num = (s: string | undefined): number => (s ? parseFloat(s) : 0);

function pickAction(arr: { action_type: string; value: string }[] | undefined, types: string[]): number {
  if (!arr) return 0;
  for (const t of types) {
    const hit = arr.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return 0;
}

/** Extract the 7 judged KPIs (+ extras) from an insights row. */
export function insightMetrics(r: MetaInsightRow) {
  const spend = num(r.spend);
  const purchases = pickAction(r.actions, PURCHASE_TYPES);
  const roas = r.purchase_roas?.length ? num(r.purchase_roas[0].value) : 0;
  const cpPurchase = pickAction(r.cost_per_action_type, PURCHASE_TYPES);
  return {
    spend,
    impressions: Math.round(num(r.impressions)),
    clicks: Math.round(num(r.clicks)),
    ctr: num(r.ctr),
    cpm: num(r.cpm),
    reach: Math.round(num(r.reach)),
    frequency: num(r.frequency),
    roas,
    purchases: Math.round(purchases),
    cpa: cpPurchase, // cost per purchase (our cpa baseline)
    cpp: cpPurchase, // our cpp = cost/purchase (NOT Meta's reach-based cpp)
    cpr: cpPurchase, // cost/result proxy until per-goal results are pulled
  };
}

/** Meta creative object_type → our enum (best-effort). */
export function toFormat(objectType?: string): PrismaFormat {
  switch ((objectType ?? "").toUpperCase()) {
    case "VIDEO":
      return "VIDEO";
    case "SHARE":
    case "PHOTO":
    case "STATUS":
      return "IMAGE";
    default:
      return "IMAGE";
  }
}

/** Meta campaign status → our enum. */
export function toAdStatus(status?: string): "ACTIVE" | "PAUSED" {
  return (status ?? "").toUpperCase() === "ACTIVE" ? "ACTIVE" : "PAUSED";
}
