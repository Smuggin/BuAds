/**
 * Client data-access layer. Components read through these typed fetchers (never
 * importing seed arrays directly), so swapping mock → Meta is a one-layer change:
 * only app/api/*'s bodies change, these signatures stay identical.
 */
import type {
  AvailableAccount,
  Campaign,
  Category,
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
    autoClose?: boolean;
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
  autoClose?: boolean;
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

export const getOverview = () => getJSON<OverviewData>("/api/overview");
export const getProducts = () => getJSON<Product[]>("/api/products");
export const getCampaigns = () => getJSON<Campaign[]>("/api/campaigns");
export const getCreatives = () => getJSON<Creative[]>("/api/creatives");
export const getRules = () => getJSON<Rule[]>("/api/rules");
export const getLogs = () => getJSON<LogEntry[]>("/api/logs");
export const getNotifications = () => getJSON<Notification[]>("/api/notifications");
export const getCategories = () => getJSON<Category[]>("/api/categories");
export const getSettings = () =>
  getJSON<{ connected: ConnectionAccount[]; available: AvailableAccount[] }>("/api/settings");
