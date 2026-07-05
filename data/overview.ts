/**
 * Overview + Breakdown seed data. Values mirror the reference prototype.
 * The KPI summary strip (SUMMARY_CARDS) renders on every page (shell).
 */
import type { OverviewAccountRow, SummaryCard } from "./types";

export const SUMMARY_CARDS: SummaryCard[] = [
  { en: "Total Spend", th: "รายจ่ายรวม", value: "฿284,500", delta: "12.4%", tone: "neutral", up: true },
  { en: "Revenue", th: "รายได้", value: "฿1.32M", delta: "18.2%", tone: "pos", up: true },
  { en: "ROAS", th: "ผลตอบแทน", value: "4.64x", delta: "5.1%", tone: "pos", up: true },
  { en: "Purchases", th: "ยอดสั่งซื้อ", value: "1,847", delta: "9.7%", tone: "pos", up: true },
  { en: "Avg CPA", th: "ต้นทุน/ออเดอร์", value: "฿154", delta: "3.2%", tone: "pos", up: false },
  { en: "CTR", th: "อัตราคลิก", value: "1.82%", delta: "0.18pt", tone: "pos", up: true },
];

/** Daily spend, last 30 days (accent bars on Overview). */
export const DAILY_SPEND: number[] = [
  7200, 6800, 8100, 9400, 7600, 6900, 8800, 10200, 9100, 7800, 8400, 9600, 11200,
  8900, 7400, 8000, 9800, 10600, 9200, 8100, 7600, 9400, 11800, 10200, 8600, 7900,
  9100, 10800, 9600, 8200,
];

/** Ad-accounts table (display rows + raw spend for share math). */
export const OVERVIEW_ACCOUNTS: OverviewAccountRow[] = [
  { name: "ร้านหลัก TH", platform: "Main Store · FB+IG", initials: "TH", spend: "฿84,200", revenue: "฿412,000", roas: "4.89x", purchases: "612", cpa: "฿137", ctr: "2.10%", status: "Active", rawSpend: 84200, color: "#16181d" },
  { name: "Skincare Brand", platform: "Beauty · FB+IG", initials: "SK", spend: "฿62,400", revenue: "฿318,000", roas: "5.10x", purchases: "388", cpa: "฿161", ctr: "1.94%", status: "Active", rawSpend: 62400, color: "#3b6fe0" },
  { name: "Bangkok Retail", platform: "Retail · FB", initials: "BK", spend: "฿48,900", revenue: "฿196,000", roas: "4.01x", purchases: "274", cpa: "฿178", ctr: "1.66%", status: "Active", rawSpend: 48900, color: "#e0813b" },
  { name: "Lazada Push", platform: "Marketplace · FB", initials: "LZ", spend: "฿41,200", revenue: "฿188,500", roas: "4.58x", purchases: "301", cpa: "฿137", ctr: "1.88%", status: "Active", rawSpend: 41200, color: "#1f8a5b" },
  { name: "Shopee Promo", platform: "Marketplace · FB", initials: "SP", spend: "฿33,800", revenue: "฿142,000", roas: "4.20x", purchases: "198", cpa: "฿171", ctr: "1.55%", status: "Paused", rawSpend: 33800, color: "#d64545" },
  { name: "Fashion Line", platform: "Apparel · IG", initials: "FL", spend: "฿14,000", revenue: "฿61,500", roas: "4.39x", purchases: "74", cpa: "฿189", ctr: "1.40%", status: "Active", rawSpend: 14000, color: "#6E56CF" },
];

/** Account-level audience breakdown (Breakdown page). */
export type AgeRow = [label: string, pct: number, roas: number];
export type GenderRow = [label: string, pct: number, roas: number, color: string];
export type ProvinceRow = [label: string, pct: number, roas: number];

export const AGE_DATA: AgeRow[] = [
  ["18–24", 12, 3.1], ["25–34", 34, 5.2], ["35–44", 27, 5.8],
  ["45–54", 16, 4.4], ["55–64", 8, 3.6], ["65+", 3, 2.9],
];
export const GENDER_DATA: GenderRow[] = [
  ["หญิง · Female", 62, 5.1, "#3b6fe0"],
  ["ชาย · Male", 35, 3.9, "#16181d"],
  ["ไม่ระบุ · Unknown", 3, 2.4, "#c2c7cf"],
];
export const PROVINCE_DATA: ProvinceRow[] = [
  ["กรุงเทพฯ · Bangkok", 38, 4.8], ["นนทบุรี · Nonthaburi", 9, 4.4],
  ["สมุทรปราการ · Samut Prakan", 7, 4.1], ["เชียงใหม่ · Chiang Mai", 7, 5.2],
  ["ชลบุรี · Chonburi", 6, 4.6], ["ขอนแก่น · Khon Kaen", 5, 3.9],
  ["นครราชสีมา · Korat", 4, 3.7], ["สงขลา · Songkhla", 4, 4.0],
];
export const HEAT_DATA: { days: string[]; grid: number[][] } = {
  days: ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"],
  grid: [
    [10, 8, 6, 5, 12, 28, 40, 52, 46, 58, 72, 55],
    [9, 7, 6, 6, 14, 30, 42, 50, 48, 60, 70, 52],
    [11, 8, 7, 6, 15, 32, 44, 54, 50, 62, 74, 58],
    [10, 9, 7, 7, 16, 34, 46, 56, 52, 64, 78, 60],
    [12, 10, 8, 8, 18, 38, 50, 60, 58, 72, 88, 70],
    [16, 12, 10, 10, 22, 42, 56, 66, 70, 84, 96, 82],
    [15, 13, 10, 9, 20, 40, 52, 62, 66, 80, 90, 76],
  ],
};
