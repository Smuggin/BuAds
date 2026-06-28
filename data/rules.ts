/** Automation rule seed. Mirrors the reference prototype. */
import type { Rule } from "./types";

export const RULES: Rule[] = [
  { id: "r1", name: "หยุดแคมเปญ CPA สูง", ifCondition: "CPA > ฿200 ต่อเนื่อง 2 วัน", thenAction: "หยุดแคมเปญอัตโนมัติ", scope: "Sales · ทุกบัญชี", lastRun: "2 ชม.ที่แล้ว", runs: 14, on: true, type: "pause", tone: "#d6453d" },
  { id: "r2", name: "เพิ่มงบ ROAS ดี", ifCondition: "ROAS > 5.0 ต่อเนื่อง 3 วัน", thenAction: "เพิ่มงบ +20%", scope: "Sales", lastRun: "1 วันที่แล้ว", runs: 8, on: true, type: "trendUp", tone: "#1f8a5b" },
  { id: "r3", name: "ลดงบ ROAS ต่ำ", ifCondition: "ROAS < 2.5", thenAction: "ลดงบ −30%", scope: "ทุกบัญชี", lastRun: "5 ชม.ที่แล้ว", runs: 22, on: true, type: "trendDown", tone: "#c98a16" },
  { id: "r4", name: "เปิด Ads ช่วง Prime", ifCondition: "เวลา 18:00 – 23:00 น.", thenAction: "เปิด Reels ad set", scope: "Skincare · Fashion", lastRun: "วันนี้", runs: 30, on: true, type: "clock", tone: "#3b6fe0" },
  { id: "r5", name: "แจ้งเตือนงบใกล้หมด", ifCondition: "ใช้งบ > 90% ของงบรายวัน", thenAction: "แจ้งเตือนผ่าน LINE", scope: "ทุกบัญชี", lastRun: "3 ชม.ที่แล้ว", runs: 41, on: true, type: "bell", tone: "#3b6fe0" },
  { id: "r6", name: "ปิด Ad fatigue", ifCondition: "Frequency > 3.5", thenAction: "หยุด ad set", scope: "ทุกบัญชี", lastRun: "4 วันที่แล้ว", runs: 6, on: false, type: "pause", tone: "#838992" },
];
