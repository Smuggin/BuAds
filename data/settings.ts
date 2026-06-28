/** Settings: connected + available ad accounts. Mirrors the reference prototype. */
import type { AvailableAccount, ConnectionAccount } from "./types";

export const CONNECTION_ACCOUNTS: ConnectionAccount[] = [
  { id: "act_1098432", name: "ร้านหลัก TH", platform: "Meta · FB + IG", initials: "TH", color: "#16181d", connected: true, status: "active", lastSync: "2 นาทีที่แล้ว", spend: "฿84,200", products: 4 },
  { id: "act_2387651", name: "Skincare Brand", platform: "Meta · FB + IG", initials: "SK", color: "#3b6fe0", connected: true, status: "active", lastSync: "5 นาทีที่แล้ว", spend: "฿62,400", products: 3 },
  { id: "act_5512098", name: "Bangkok Retail", platform: "Meta · FB", initials: "BK", color: "#1f8a5b", connected: true, status: "active", lastSync: "12 นาทีที่แล้ว", spend: "฿48,900", products: 2 },
  { id: "act_7741230", name: "Lazada Push", platform: "Meta · FB", initials: "LZ", color: "#6E56CF", connected: true, status: "syncing", lastSync: "กำลังซิงค์…", spend: "฿41,200", products: 2 },
  { id: "act_3320145", name: "Shopee Promo", platform: "Meta · FB", initials: "SP", color: "#c98a16", connected: true, status: "warning", lastSync: "1 ชม.ที่แล้ว", spend: "฿33,800", products: 1 },
  { id: "act_9087612", name: "Fashion Line", platform: "Meta · IG", initials: "FL", color: "#d6453d", connected: true, status: "active", lastSync: "8 นาทีที่แล้ว", spend: "฿14,000", products: 2 },
];

export const AVAILABLE_ACCOUNTS: AvailableAccount[] = [
  { id: "act_4471309", name: "Wellness Co.", platform: "Meta · FB + IG", initials: "WC", color: "#2f6fd0" },
  { id: "act_6650921", name: "Pet Supplies TH", platform: "Meta · FB", initials: "PS", color: "#1f8a5b" },
  { id: "act_8812044", name: "Home Decor Studio", platform: "Meta · IG", initials: "HD", color: "#6E56CF" },
];
