/**
 * Notification seed (bell dropdown). Values mirror the reference prototype.
 */
import type { Notification } from "./types";

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    kind: "success",
    time: "14:55",
    title: "ระบบปิดแคมเปญอัตโนมัติ",
    detail: "Night Cream – Reels · ROAS 2.8x ต่ำกว่าเกณฑ์ — ปิดเรียบร้อย",
  },
  {
    id: "n2",
    kind: "success",
    time: "13:40",
    title: "ระบบเพิ่มงบอัตโนมัติ +20%",
    detail: "Gift Set – Bundle Push · ROAS 7.2x — งบ ฿600 → ฿720",
  },
  {
    id: "n3",
    kind: "warn",
    time: "12:08",
    title: "แคมเปญเกินเกณฑ์ แต่ยังเปิดอยู่",
    detail: "Bag – Lookalike · CPA เกินเกณฑ์ — ปิดอัตโนมัติของสินค้านี้ยังปิดใช้งาน",
  },
  {
    id: "n4",
    kind: "warn",
    time: "10:30",
    title: "กฎอัตโนมัติถูกปิดใช้งาน",
    detail: "“ปิด Ad fatigue” หยุดทำงานตั้งแต่ 4 วันก่อน",
  },
  {
    id: "n5",
    kind: "success",
    time: "09:12",
    title: "ระบบปิดแคมเปญอัตโนมัติ",
    detail: "Tee – Engagement IG · CPA ฿180 เกินเกณฑ์ ฿80 — ปิดเรียบร้อย",
  },
  {
    id: "n6",
    kind: "warn",
    time: "08:40",
    title: "งบใกล้หมดรายวัน",
    detail: "Serum – Prospecting BKK · ใช้งบ 92% ของงบรายวันแล้ว",
  },
  {
    id: "n7",
    kind: "info",
    time: "เมื่อวาน",
    title: "แก้เกณฑ์ KPI สินค้า",
    detail: "ครีมบำรุงกลางคืน · CPA ≤ ฿120 → ฿110",
  },
];
