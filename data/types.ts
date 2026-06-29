/**
 * Typed data contracts — see .ai/data-contracts.md.
 * Verdict / status / on-off are NEVER stored here; they are derived by lib/kpi.ts.
 */

// Account relation key. Demo data uses SKIN/MAIN/FASH/LAZ; live Meta data uses
// real `act_…` ids — so this is a widened string (use accountMetaFor() for display).
export type AccountKey = string;

export type MetricKey = "roas" | "ctr" | "cpa" | "cpm" | "cpp" | "cpr" | "cost";
export type MetricDir = "min" | "max";
export type Thresholds = Record<MetricKey, number>;
export type Metrics = Record<MetricKey, number>;

export type Verdict = "marked" | "running" | "breach";
export type CreativeFormat = "Video" | "Reels" | "Carousel" | "Image";
export type ProfileKey = "A" | "B" | "C";

export interface MetricDef {
  key: MetricKey;
  short: string;
  dir: MetricDir;
  money: boolean;
  suffix: "" | "x" | "%";
}

export interface AccountMeta {
  th: string;
  en: string;
  initials: string;
  color: string;
}

export interface Product {
  sku: string;
  th: string;
  en: string;
  category: string;
  accounts: AccountKey[];
  unitCost: number;
  img: string | null;
  thresholds: Thresholds;
  autoClose: boolean;
  custom?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  sku: string;
  account: AccountKey;
  budget: number;
  metrics: Metrics;
}

export interface Creative {
  id: string;
  name: string;
  format: CreativeFormat;
  sku: string;
  campaigns: string[];
  profileKey: ProfileKey;
  spend: number;
  impressions: number;
  roas: number;
  ctr: number;
  cpa: number;
  purchases: number;
  frequency: number;
}

export interface AudienceProfile {
  age: number[]; // 6
  gender: number[]; // 3
  province: number[]; // 8
  day: number[]; // 7
  hour: number[]; // 12
}

export type RuleType = "pause" | "trendUp" | "trendDown" | "clock" | "bell";

export interface Rule {
  id: string;
  name: string;
  scope: string;
  ifCondition: string;
  thenAction: string;
  type: RuleType;
  tone: string;
  runs: number;
  lastRun: string;
  on: boolean;
}

export type LogActor = "manual" | "auto";
export type LogType =
  | "budget_up"
  | "budget_down"
  | "pause"
  | "resume"
  | "auto_close"
  | "scale"
  | "kpi_edit";
export type LogDayKey = string; // "today" | "yesterday" | dated bucket

export interface LogEntry {
  id: string;
  day: LogDayKey;
  time: string;
  campaignId?: string;
  sku?: string;
  actor: LogActor;
  type: LogType;
  title: string;
  detail: string;
  ruleName?: string;
}

export type NotificationKind = "success" | "warn" | "info";

export interface Notification {
  id: string;
  kind: NotificationKind;
  time: string;
  title: string;
  detail: string;
}

export type Category = string;

/* ---- presentation-only datasets (pre-aggregated in the prototype) ---- */

export type DeltaTone = "pos" | "neg" | "neutral";

export interface SummaryCard {
  en: string;
  th: string;
  value: string;
  delta: string;
  tone: DeltaTone;
  up: boolean;
}

export interface OverviewAccountRow {
  name: string;
  platform: string;
  initials: string;
  spend: string;
  revenue: string;
  roas: string;
  purchases: string;
  cpa: string;
  ctr: string;
  status: "Active" | "Paused";
  rawSpend: number;
}

export type ConnStatus = "active" | "syncing" | "warning";

export interface ConnectionAccount {
  id: string;
  name: string;
  platform: string;
  initials: string;
  color: string;
  connected: boolean;
  status: ConnStatus;
  lastSync: string;
  spend?: string;
  products?: number;
}

export interface AvailableAccount {
  id: string;
  name: string;
  platform: string;
  initials: string;
  color: string;
}
