/** Activity log seed + day-bucket labels. Mirrors the reference prototype. */
import type { LogEntry } from "./types";

export const LOGS: LogEntry[] = [
  { id: "l1", day: "today", time: "14:55", campaignId: "k6", actor: "auto", type: "auto_close", ruleName: "ลดงบ ROAS ต่ำ", title: "ปิดแคมเปญอัตโนมัติ", detail: "ROAS 2.8x ต่ำกว่าเกณฑ์ 4.0x ของสินค้า" },
  { id: "l2", day: "today", time: "13:40", campaignId: "k11", actor: "auto", type: "scale", ruleName: "เพิ่มงบ ROAS ดี", title: "เพิ่มงบ +20%", detail: "฿600 → ฿720/วัน · ROAS 7.2x" },
  { id: "l3", day: "today", time: "11:20", campaignId: "k3", actor: "manual", type: "budget_up", title: "เพิ่มงบ +20%", detail: "฿1,200 → ฿1,440/วัน" },
  { id: "l4", day: "today", time: "10:05", campaignId: "k1", actor: "manual", type: "resume", title: "เปิดแคมเปญ", detail: "เปิดจากที่หยุดไว้เมื่อวาน" },
  { id: "l5", day: "today", time: "09:12", campaignId: "k8", actor: "auto", type: "auto_close", ruleName: "หยุดแคมเปญ CPA สูง", title: "ปิดแคมเปญอัตโนมัติ", detail: "CPA ฿180 เกินเกณฑ์ ฿80 ของสินค้า" },
  { id: "l6", day: "yesterday", time: "16:30", sku: "NGT-09", actor: "manual", type: "kpi_edit", title: "แก้เกณฑ์ KPI สินค้า", detail: "CPA ≤ ฿120 → ฿110" },
  { id: "l7", day: "yesterday", time: "15:10", campaignId: "k5", actor: "manual", type: "pause", title: "หยุดแคมเปญ", detail: "หยุดเพื่อปรับครีเอทีฟใหม่" },
  { id: "l8", day: "yesterday", time: "11:02", campaignId: "k2", actor: "auto", type: "budget_down", ruleName: "ลดงบ ROAS ต่ำ", title: "ลดงบ −30%", detail: "฿2,600 → ฿1,820/วัน · ROAS 3.9x" },
  { id: "l9", day: "yesterday", time: "09:45", campaignId: "k7", actor: "manual", type: "budget_up", title: "เพิ่มงบ +25%", detail: "฿640 → ฿800/วัน" },
  { id: "l10", day: "d24", time: "14:20", campaignId: "k4", actor: "manual", type: "budget_up", title: "เพิ่มงบ +10%", detail: "฿1,080 → ฿1,200/วัน" },
  { id: "l11", day: "d24", time: "10:35", campaignId: "k10", actor: "manual", type: "pause", title: "หยุดแคมเปญ", detail: "งบรวมเกินเป้าเดือน" },
  { id: "l12", day: "d24", time: "08:50", campaignId: "k12", actor: "auto", type: "scale", ruleName: "เพิ่มงบ ROAS ดี", title: "เพิ่มงบ +20%", detail: "฿500 → ฿600/วัน · ROAS 4.6x" },
  { id: "l13", day: "d23", time: "17:05", sku: "SUN-50", actor: "manual", type: "kpi_edit", title: "แก้เกณฑ์ KPI สินค้า", detail: "ROAS ≥ 3.8x → 4.0x" },
  { id: "l14", day: "d23", time: "12:15", campaignId: "k1", actor: "manual", type: "pause", title: "หยุดแคมเปญ", detail: "พักชั่วคราว" },
];

/** Day buckets in display order: [key, label]. */
export const LOG_DAYS: [string, string][] = [
  ["today", "วันนี้ · Today"],
  ["yesterday", "เมื่อวาน · Yesterday"],
  ["d24", "จันทร์ 24 มิ.ย."],
  ["d23", "อาทิตย์ 23 มิ.ย."],
];
