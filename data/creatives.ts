/** Creative seed. Mirrors the reference prototype. */
import type { Creative } from "./types";

export const CREATIVES: Creative[] = [
  { id: "cr1", name: "Serum – Before/After", format: "Video", sku: "SRM-01", campaigns: ["k1", "k2"], profileKey: "A", spend: 24800, impressions: 412000, roas: 5.8, ctr: 2.4, cpa: 78, purchases: 318, frequency: 2.1 },
  { id: "cr2", name: "Serum – UGC Review", format: "Reels", sku: "SRM-01", campaigns: ["k1"], profileKey: "A", spend: 9200, impressions: 188000, roas: 6.4, ctr: 2.9, cpa: 71, purchases: 130, frequency: 1.8 },
  { id: "cr3", name: "Sunscreen – Beach Demo", format: "Video", sku: "SUN-50", campaigns: ["k3", "k4"], profileKey: "B", spend: 18600, impressions: 322000, roas: 4.7, ctr: 1.8, cpa: 86, purchases: 214, frequency: 2.4 },
  { id: "cr4", name: "Sunscreen – Carousel", format: "Carousel", sku: "SUN-50", campaigns: ["k4"], profileKey: "B", spend: 8800, impressions: 142000, roas: 4.1, ctr: 1.5, cpa: 94, purchases: 92, frequency: 2.0 },
  { id: "cr5", name: "Night Cream – Routine", format: "Image", sku: "NGT-09", campaigns: ["k5", "k6"], profileKey: "B", spend: 14200, impressions: 236000, roas: 3.6, ctr: 1.4, cpa: 118, purchases: 121, frequency: 2.7 },
  { id: "cr6", name: "Tee – Lifestyle", format: "Image", sku: "TEE-22", campaigns: ["k7", "k8"], profileKey: "C", spend: 13800, impressions: 258000, roas: 3.9, ctr: 1.5, cpa: 96, purchases: 142, frequency: 2.2 },
  { id: "cr7", name: "Bag – Flatlay", format: "Image", sku: "BAG-07", campaigns: ["k9", "k10"], profileKey: "C", spend: 11600, impressions: 198000, roas: 3.4, ctr: 1.2, cpa: 124, purchases: 88, frequency: 2.5 },
  { id: "cr8", name: "Gift Set – Unboxing", format: "Reels", sku: "GFT-03", campaigns: ["k11", "k12"], profileKey: "A", spend: 13400, impressions: 262000, roas: 6.1, ctr: 2.6, cpa: 73, purchases: 138, frequency: 1.9 },
];
