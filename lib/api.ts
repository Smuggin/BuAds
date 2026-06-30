/**
 * Client data-access layer. Components read through these typed fetchers (never
 * importing seed arrays directly), so swapping mock → Meta is a one-layer change:
 * only app/api/*'s bodies change, these signatures stay identical.
 */
import type {
  AvailableAccount,
  Campaign,
  Category,
  CloseMode,
  ConnectionAccount,
  Creative,
  LogEntry,
  Notification,
  OverviewAccountRow,
  Product,
  Rule,
  SummaryCard,
} from "@/data/types";
import type { AgeRow, GenderRow, ProvinceRow } from "@/data/overview";
import type { BreakdownData } from "@/lib/breakdown";

export type { BreakdownData };

export interface OverviewData {
  summary: SummaryCard[];
  daily: number[];
  accounts: OverviewAccountRow[];
  breakdown: {
    age: AgeRow[];
    gender: GenderRow[];
    province: ProvinceRow[];
    heat: { days: string[]; grid: number[][] };
  };
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface SyncResult {
  accounts: number;
  campaigns: number;
  insights: number;
  autoClosed: number;
  creatives: number;
  creativeLinks: number;
  creativeInsights: number;
  breakdowns: number;
  startedAt: string;
  errors: string[];
}

/** Trigger a live Meta sync: pulls accounts → campaigns → insights and auto-links
 *  each campaign to a SKU by its Thai-name segment. Throws on failure. */
export async function runMetaSync(): Promise<SyncResult> {
  const res = await fetch("/api/sync", { method: "POST" });
  const data = (await res.json().catch(() => ({}))) as Partial<SyncResult> & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `sync failed (${res.status})`);
  return data as SyncResult;
}

/** Lightweight on/off status mirror from Meta (no insights). Best-effort — used by
 *  the Campaigns page on tab focus; the next poll/refetch catches up on error. */
export async function runStatusSync(): Promise<void> {
  try {
    await fetch("/api/sync/status", { method: "POST" });
  } catch {
    /* ignore */
  }
}

/** Persist a product edit — profile (name/category/cost/img/accounts) or KPI
 *  threshold / auto-close (Phase 9). Throws on error. */
export async function patchProduct(
  sku: string,
  body: {
    thresholds?: Record<string, number>;
    closeMode?: CloseMode;
    th?: string;
    category?: string;
    unitCost?: number;
    img?: string | null;
    accounts?: string[];
  },
): Promise<void> {
  const res = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `save failed (${res.status})`);
  }
}

/** Create a new product. Returns the assigned SKU. Throws on conflict/error. */
export async function createProduct(body: {
  sku?: string;
  th: string;
  category: string;
  accounts?: string[];
  unitCost: number;
  img?: string | null;
  closeMode?: CloseMode;
  thresholds?: Partial<Record<string, number>>;
}): Promise<string> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { sku?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? `create failed (${res.status})`);
  return data.sku!;
}

/** Manually link / unlink a campaign to a product by SKU (override of auto-match). */
export async function assignCampaignProduct(
  campaignId: string,
  sku: string | null,
): Promise<void> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `assign failed (${res.status})`);
  }
}

/** Delete a product by SKU. */
export async function deleteProduct(sku: string): Promise<void> {
  const res = await fetch(`/api/products/${encodeURIComponent(sku)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete failed (${res.status})`);
}

export interface AccountOption {
  id: string;
  name: string;
  initials: string;
  color: string;
}
/** Connected ad accounts (synced from Meta) for the catalog account pickers. */
export const getAccounts = () => getJSON<AccountOption[]>("/api/accounts");

/** Account-scoped overview (account = metaAccountId | "all", range = 7d|30d|90d). */
export const getOverview = (account = "all", range = "30d") =>
  getJSON<OverviewData>(`/api/overview?account=${encodeURIComponent(account)}&range=${range}`);
/** Account-wide audience breakdown for the Breakdown page (range + account filter). */
export const getBreakdown = (range: string, account: string) =>
  getJSON<BreakdownData>(`/api/breakdown?range=${range}&account=${encodeURIComponent(account)}`);
/** metaAccountIds with audience data for a range (others are disabled in the top-bar
 *  filter on the Breakdown page). */
export const getBreakdownAccounts = (range: string) =>
  getJSON<string[]>(`/api/breakdown/accounts?range=${range}`);
export const getProducts = () => getJSON<Product[]>("/api/products");
export const getCampaigns = (range = "30d") => getJSON<Campaign[]>(`/api/campaigns?range=${range}`);
export const getCreatives = (range = "30d") => getJSON<Creative[]>(`/api/creatives?range=${range}`);
export const getRules = () => getJSON<Rule[]>("/api/rules");
/** Persist a rule's on/off (the cron honors Rule.on). */
export async function patchRule(id: string, on: boolean): Promise<void> {
  const res = await fetch(`/api/rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ on }),
  });
  if (!res.ok) throw new Error(`rule toggle failed (${res.status})`);
}
export const getLogs = () => getJSON<LogEntry[]>("/api/logs");
export const getNotifications = () => getJSON<Notification[]>("/api/notifications");
export const getCategories = () => getJSON<Category[]>("/api/categories");
export const getSettings = () =>
  getJSON<{ connected: ConnectionAccount[]; available: AvailableAccount[] }>("/api/settings");
