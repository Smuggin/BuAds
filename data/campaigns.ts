/** Campaign seed (measured metrics; verdict is derived, never stored). Mirrors prototype. */
import type { Campaign } from "./types";

export const CAMPAIGNS: Campaign[] = [
  { id: "k1", name: "Serum – Retarget 7d", sku: "SRM-01", account: "SKIN", budget: 1500, metrics: { roas: 6.8, ctr: 2.6, cpa: 70, cpm: 88, cpp: 120, cpr: 42, cost: 1400 } },
  { id: "k2", name: "Serum – Prospecting BKK", sku: "SRM-01", account: "SKIN", budget: 2000, metrics: { roas: 3.9, ctr: 1.5, cpa: 130, cpm: 120, cpp: 190, cpr: 75, cost: 1800 } },
  { id: "k3", name: "Sunscreen – LAL 2%", sku: "SUN-50", account: "SKIN", budget: 1200, metrics: { roas: 5.1, ctr: 1.9, cpa: 80, cpm: 84, cpp: 130, cpr: 46, cost: 1100 } },
  { id: "k4", name: "Sunscreen – Broad", sku: "SUN-50", account: "MAIN", budget: 1200, metrics: { roas: 4.2, ctr: 1.6, cpa: 92, cpm: 88, cpp: 138, cpr: 49, cost: 1180 } },
  { id: "k5", name: "Night Cream – Retarget", sku: "NGT-09", account: "MAIN", budget: 1000, metrics: { roas: 4.4, ctr: 1.6, cpa: 100, cpm: 96, cpp: 160, cpr: 60, cost: 880 } },
  { id: "k6", name: "Night Cream – Reels", sku: "NGT-09", account: "MAIN", budget: 1200, metrics: { roas: 2.8, ctr: 1.1, cpa: 145, cpm: 130, cpp: 220, cpr: 90, cost: 1100 } },
  { id: "k7", name: "Tee – Catalog DPA", sku: "TEE-22", account: "FASH", budget: 800, metrics: { roas: 5.0, ctr: 1.8, cpa: 60, cpm: 78, cpp: 110, cpr: 38, cost: 760 } },
  { id: "k8", name: "Tee – Engagement IG", sku: "TEE-22", account: "FASH", budget: 1000, metrics: { roas: 1.9, ctr: 0.9, cpa: 180, cpm: 140, cpp: 260, cpr: 110, cost: 900 } },
  { id: "k9", name: "Bag – Prospecting", sku: "BAG-07", account: "FASH", budget: 800, metrics: { roas: 3.6, ctr: 1.3, cpa: 115, cpm: 105, cpp: 175, cpr: 66, cost: 690 } },
  { id: "k10", name: "Bag – Lookalike", sku: "BAG-07", account: "LAZ", budget: 800, metrics: { roas: 3.1, ctr: 1.1, cpa: 135, cpm: 120, cpp: 200, cpr: 80, cost: 760 } },
  { id: "k11", name: "Gift Set – Bundle Push", sku: "GFT-03", account: "SKIN", budget: 600, metrics: { roas: 7.2, ctr: 2.8, cpa: 65, cpm: 90, cpp: 115, cpr: 40, cost: 560 } },
  { id: "k12", name: "Gift Set – Broad", sku: "GFT-03", account: "LAZ", budget: 600, metrics: { roas: 4.6, ctr: 2.0, cpa: 88, cpm: 93, cpp: 145, cpr: 53, cost: 590 } },
];
