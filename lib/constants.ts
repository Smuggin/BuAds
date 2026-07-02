/**
 * App-level static config (framework-agnostic). See .ai/data-contracts.md.
 * Values mirror reference/AdsHub.prototype.dc.html.
 */
import type {
  AccountKey,
  AccountMeta,
  CreativeFormat,
  LogType,
  MetricDef,
} from "@/data/types";

export interface NavItem {
  id: string;
  th: string;
  en: string;
  href: string;
}

/** Nav order + routes. ids match the prototype's view ids where they differ from the path. */
export const NAV: NavItem[] = [
  { id: "overview", th: "ภาพรวมบัญชี", en: "Overview", href: "/overview" },
  { id: "campaigns", th: "แคมเปญรวม", en: "Campaigns", href: "/campaigns" },
  { id: "media", th: "สื่อ/ครีเอทีฟ", en: "Creatives", href: "/creatives" },
  { id: "breakdown", th: "เจาะลึกข้อมูล", en: "Breakdown", href: "/breakdown" },
  { id: "automation", th: "ระบบอัตโนมัติ", en: "Automation", href: "/automation" },
  { id: "activity", th: "ประวัติการทำงาน", en: "Activity log", href: "/activity" },
  { id: "products", th: "เกณฑ์ KPI สินค้า", en: "Product KPI", href: "/product-kpi" },
  { id: "catalog", th: "คลังสินค้า", en: "Product catalog", href: "/catalog" },
  { id: "settings", th: "ตั้งค่า & เชื่อมต่อ", en: "Settings", href: "/settings" },
];

/** Page title + subtitle per route. Keyed by href. */
export const TITLES: Record<string, [string, string]> = {
  "/overview": ["ภาพรวมทุกบัญชี", "Multi-account performance overview"],
  "/campaigns": [
    "แคมเปญแยกตามสินค้า",
    "Campaigns by product — auto-marked & auto-closed by KPI",
  ],
  "/creatives": [
    "คลังครีเอทีฟ",
    "Creative library — performance, campaigns & audience breakdown",
  ],
  "/breakdown": [
    "เจาะลึกกลุ่มเป้าหมาย",
    "Audience breakdown — age, gender, region & time",
  ],
  "/automation": ["ระบบอัตโนมัติ", "Automated rules — auto on/off & budget scaling"],
  "/activity": ["ประวัติการทำงาน", "Action log — every change, by team or automation"],
  "/product-kpi": [
    "เกณฑ์ KPI รายสินค้า",
    "Set acceptable limits per product — drives marking & auto-close",
  ],
  "/catalog": ["คลังสินค้า", "Product catalog — add products, photos & unit cost"],
  "/settings": [
    "ตั้งค่า & เชื่อมต่อบัญชี",
    "Connect ad accounts & review what is linked",
  ],
};

export interface RangeDef {
  id: "today" | "7d" | "30d" | "90d";
  label: string;
}
export const RANGES: RangeDef[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
];

/** Relation-key display meta (demo accounts). Real `act_…` accounts use accountMetaFor(). */
export const ACCOUNT_META: Record<string, AccountMeta> = {
  SKIN: { th: "Skincare Brand", en: "FB + IG", initials: "SK", color: "#3b6fe0" },
  MAIN: { th: "ร้านหลัก TH", en: "FB + IG", initials: "TH", color: "#16181d" },
  FASH: { th: "Fashion Line", en: "IG", initials: "FL", color: "#6E56CF" },
  LAZ: { th: "Lazada Push", en: "FB", initials: "LZ", color: "#1f8a5b" },
};

/** Display meta for any account id — the demo map, else derived (live act_… accounts). */
export function accountMetaFor(id: string, name?: string): AccountMeta {
  const known = ACCOUNT_META[id];
  if (known) return known;
  const label = name?.trim() || id;
  const initials =
    label.replace(/[^A-Za-z0-9ก-๙]/g, "").slice(0, 2).toUpperCase() || "AD";
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { th: label, en: "Meta", initials, color: RAMP[hash % RAMP.length] };
}

// Judged KPIs, in display order (DESIGN §5 / .ai/kpi-engine.md).
// cpr (cost per result) is intentionally omitted: it currently mirrors cpp
// (cost per purchase) since per-goal results aren't pulled yet (see lib/meta/map.ts).
// The cpr data field + thresholds remain for when real per-goal results land.
export const METRIC_DEFS: MetricDef[] = [
  { key: "roas", short: "ROAS", dir: "min", money: false, suffix: "x" },
  { key: "ctr", short: "CTR", dir: "min", money: false, suffix: "%" },
  { key: "cpa", short: "CPA", dir: "max", money: true, suffix: "" },
  { key: "cpm", short: "CPM", dir: "max", money: true, suffix: "" },
  { key: "cpp", short: "Purchase", dir: "max", money: true, suffix: "" },
  { key: "cost", short: "Cost/วัน", dir: "max", money: true, suffix: "" },
];

/** The KPIs the team actually configures + reviews: the campaign-table columns and the
 *  Product-KPI page share this exact set (roas, ctr, cpm, cpp). Excludes CPA and Cost/วัน.
 *  Single source of truth — editing it updates both pages together. */
export const KPI_METRIC_DEFS: MetricDef[] = METRIC_DEFS.filter(
  (m) => m.key !== "cpa" && m.key !== "cost",
);

/** Categorical ramp (avatars, spend-share, charts). DESIGN §2. */
export const RAMP = [
  "#16181d",
  "#2f57b0",
  "#3b6fe0",
  "#6c93ea",
  "#9db8f1",
  "#cdd9f8",
];

export const MARKED_ROAS_MULTIPLIER = 1.2;

/** Default thresholds applied to user-added catalog products (editable later in Product KPI). */
export const DEFAULT_THRESHOLDS = {
  roas: 4,
  ctr: 1.5,
  cpa: 100,
  cpm: 100,
  cpp: 160,
  cpr: 60,
  cost: 1000,
} as const;

/** Creative format → thumb icon + color (DESIGN §4.3). */
export const FORMAT_META: Record<CreativeFormat, { icon: string; color: string }> = {
  Video: { icon: "▶", color: "#d6453d" },
  Reels: { icon: "❏", color: "#6E56CF" },
  Carousel: { icon: "▥", color: "#c98a16" },
  Image: { icon: "▣", color: "#3b6fe0" },
};

/** Activity log: actor badge meta (icon names are strings — no React in constants). */
export const LOG_ACTOR_META = {
  manual: { label: "ทีมงาน", sub: "Manual", avatar: "PJ", color: "#3b6fe0", bg: "#eef3fe" },
  auto: { label: "ระบบอัตโนมัติ", sub: "Automation", icon: "bolt", color: "#6E56CF", bg: "#f0edfb" },
} as const;

/** Activity log: per-type icon (Icon name) + color. */
export const LOG_TYPE_META: Record<LogType, { icon: string; color: string }> = {
  budget_up: { icon: "trendUp", color: "#1f8a5b" },
  budget_down: { icon: "trendDown", color: "#c98a16" },
  pause: { icon: "pause", color: "#d6453d" },
  resume: { icon: "play", color: "#1f8a5b" },
  auto_close: { icon: "pause", color: "#d6453d" },
  scale: { icon: "trendUp", color: "#1f8a5b" },
  kpi_edit: { icon: "gear", color: "#3b6fe0" },
};

/** firstClick sort direction per column — "best first". */
export function firstSortDir(key: string): "asc" | "desc" {
  if (key === "name") return "asc";
  if (key === "status" || key === "open" || key === "budget") return "desc";
  const m = METRIC_DEFS.find((d) => d.key === key);
  return m && m.dir === "min" ? "desc" : "asc";
}
