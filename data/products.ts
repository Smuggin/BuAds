/** Product seed (with per-product KPI thresholds). Mirrors the reference prototype. */
import type { Product } from "./types";

export const PRODUCTS: Product[] = [
  { sku: "SRM-01", th: "เซรั่มไบรท์เทนนิ่ง", en: "Brightening Serum", category: "Skincare", accounts: ["SKIN", "MAIN"], unitCost: 390, img: null, autoClose: true, thresholds: { roas: 4.5, ctr: 1.8, cpa: 90, cpm: 95, cpp: 150, cpr: 55, cost: 1600 } },
  { sku: "SUN-50", th: "กันแดด SPF50 PA++++", en: "UV Sunscreen", category: "Skincare", accounts: ["SKIN", "MAIN"], unitCost: 290, img: null, autoClose: true, thresholds: { roas: 4.0, ctr: 1.6, cpa: 95, cpm: 90, cpp: 140, cpr: 50, cost: 1200 } },
  { sku: "NGT-09", th: "ครีมบำรุงกลางคืน", en: "Night Repair Cream", category: "Skincare", accounts: ["MAIN"], unitCost: 450, img: null, autoClose: true, thresholds: { roas: 4.0, ctr: 1.5, cpa: 110, cpm: 100, cpp: 170, cpr: 65, cost: 900 } },
  { sku: "TEE-22", th: "เสื้อยืดพรีเมียม", en: "Premium Cotton Tee", category: "Fashion", accounts: ["FASH"], unitCost: 290, img: null, autoClose: true, thresholds: { roas: 3.5, ctr: 1.3, cpa: 80, cpm: 85, cpp: 130, cpr: 45, cost: 800 } },
  { sku: "BAG-07", th: "กระเป๋ามินิ", en: "Mini Crossbody Bag", category: "Fashion", accounts: ["FASH", "LAZ"], unitCost: 590, img: null, autoClose: false, thresholds: { roas: 3.5, ctr: 1.2, cpa: 120, cpm: 110, cpp: 180, cpr: 70, cost: 700 } },
  { sku: "GFT-03", th: "เซตของขวัญบิวตี้", en: "Beauty Gift Set", category: "Bundle", accounts: ["SKIN", "LAZ"], unitCost: 690, img: null, autoClose: true, thresholds: { roas: 4.5, ctr: 2.0, cpa: 90, cpm: 95, cpp: 150, cpr: 55, cost: 600 } },
];
