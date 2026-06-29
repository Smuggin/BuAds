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

/** Persist a product threshold / auto-close edit (Phase 9). */
export async function patchProduct(
  sku: string,
  body: { thresholds?: Record<string, number>; autoClose?: boolean },
): Promise<void> {
  await fetch(`/api/products/${encodeURIComponent(sku)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
