/**
 * Overview seed data. Values mirror the reference prototype.
 * The KPI summary strip (SUMMARY_CARDS) renders on every page (shell).
 * Daily / accounts / breakdown datasets are added in Phase 3.
 */
import type { SummaryCard } from "./types";

export const SUMMARY_CARDS: SummaryCard[] = [
  { en: "Total Spend", th: "รายจ่ายรวม", value: "฿284,500", delta: "12.4%", tone: "neutral", up: true },
  { en: "Revenue", th: "รายได้", value: "฿1.32M", delta: "18.2%", tone: "pos", up: true },
  { en: "ROAS", th: "ผลตอบแทน", value: "4.64x", delta: "5.1%", tone: "pos", up: true },
  { en: "Purchases", th: "ยอดสั่งซื้อ", value: "1,847", delta: "9.7%", tone: "pos", up: true },
  { en: "Avg CPA", th: "ต้นทุน/ออเดอร์", value: "฿154", delta: "3.2%", tone: "pos", up: false },
  { en: "CTR", th: "อัตราคลิก", value: "1.82%", delta: "0.18pt", tone: "pos", up: true },
];
