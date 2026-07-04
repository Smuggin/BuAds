/**
 * Client data-access layer. Components read through these typed fetchers (never
 * importing seed arrays directly), so swapping mock → Meta is a one-layer change:
 * only app/api/*'s bodies change, these signatures stay identical.
 */
import type {
  AudienceProfile,
  AvailableAccount,
  Campaign,
  Category,
  CloseMode,
  ConnectionAccount,
  Creative,
  LogEntry,
  MetricKey,
  Notification,
  OverviewAccountRow,
  OverviewDailyAccount,
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
  dailyDates?: string[]; // axis labels aligned to the series — ISO dates, or "HH:00" when hourly
  dailyGranularity?: "day" | "hour"; // "hour" for the "today" range (bars are per hour)
  dailyByAccount?: OverviewDailyAccount[]; // per-account spend+revenue series (stacked chart)
  accounts: OverviewAccountRow[];
  breakdown: {
    age: AgeRow[];
    gender: GenderRow[];
    province: ProvinceRow[];
    heat: { days: string[]; grid: number[][] };
  };
}

// In-flight dedupe + last-good cache.
// - inflight: concurrent identical GETs share one request (Overview and the KPI
//   strip ask for the same /api/overview in the same tick — one HTTP call).
// - lastGood: a re-mounting view paints its previous payload instantly via the
//   peek* helpers (stale-while-revalidate) instead of flashing a skeleton.
//   No TTL: peeks are only ever a first paint and are always revalidated by the
//   caller's own fetch, so staleness is bounded by that refetch.
const inflight = new Map<string, Promise<unknown>>();
const lastGood = new Map<string, unknown>();

async function getJSON<T>(path: string): Promise<T> {
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${path} → ${res.status}`);
      const data = (await res.json()) as T;
      lastGood.set(path, data);
      return data;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

/** Last successfully fetched payload for a path, or null (first-paint cache). */
function peek<T>(path: string): T | null {
  return lastGood.has(path) ? (lastGood.get(path) as T) : null;
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

/** One SyncRun row (see lib/meta/syncState.ts) — the durable, polled sync state. */
export interface SyncRunDto {
  kind: "full" | "map" | "range" | "status";
  rangeKey: string | null;
  status: "idle" | "running" | "done" | "error";
  pct: number;
  stage: string;
  counts: unknown; // SyncResult / RangeSyncResult once done
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  stale: boolean; // running but the heartbeat stopped — treat as dead
}

export interface StartSyncResponse {
  started?: boolean;
  /** A live run of this kind is already in flight — adopt it instead of duplicating. */
  alreadyRunning?: boolean;
  run: SyncRunDto;
}

async function startSyncRequest(path: string): Promise<StartSyncResponse> {
  const res = await fetch(path, { method: "POST" });
  const data = (await res.json().catch(() => ({}))) as StartSyncResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `sync failed (${res.status})`);
  return data;
}

/** Kick a full Meta sync in the background (server-detached — survives navigation).
 *  Returns immediately; progress + the final result are polled via getSyncState(). */
export const startFullSync = (): Promise<StartSyncResponse> => startSyncRequest("/api/sync/stream");

/** Kick an on-demand background sync for "today" / a custom range. */
export function startRangeSync(
  range: string,
  custom: { since: string; until: string } | null,
): Promise<StartSyncResponse> {
  const q = new URLSearchParams({ range });
  if (custom) {
    q.set("since", custom.since);
    q.set("until", custom.until);
  }
  return startSyncRequest(`/api/sync/range?${q.toString()}`);
}

/** Current sync rows (one per kind). Poll only while a sync is known to be running. */
export const getSyncState = () => getJSON<SyncRunDto[]>("/api/sync/state");

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
    scaleThresholds?: Record<string, number>;
    closeMode?: CloseMode;
    skipMetrics?: MetricKey[];
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

/** Persist a manual product order (drag-to-reorder). `skus` in desired order. */
export async function reorderProducts(skus: string[]): Promise<void> {
  const res = await fetch("/api/products/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `reorder failed (${res.status})`);
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

const overviewPath = (account = "all", range = "30d") =>
  `/api/overview?account=${encodeURIComponent(account)}&range=${range}`;
/** Account-scoped overview (account = metaAccountId | "all", range = 7d|30d|90d). */
export const getOverview = (account = "all", range = "30d") =>
  getJSON<OverviewData>(overviewPath(account, range));
/** Last overview payload for instant first paint (stale — always revalidate). */
export const peekOverview = (account = "all", range = "30d") =>
  peek<OverviewData>(overviewPath(account, range));
/** Account-wide audience breakdown for the Breakdown page (range + account filter). */
export const getBreakdown = (range: string, account: string) =>
  getJSON<BreakdownData>(`/api/breakdown?range=${range}&account=${encodeURIComponent(account)}`);
/** metaAccountIds with audience data for a range (others are disabled in the top-bar
 *  filter on the Breakdown page). */
export const getBreakdownAccounts = (range: string) =>
  getJSON<string[]>(`/api/breakdown/accounts?range=${range}`);
export const getProducts = () => getJSON<Product[]>("/api/products");
/** Last products payload for instant first paint (stale — always revalidate). */
export const peekProducts = () => peek<Product[]>("/api/products");

export interface ProductInAccount {
  sku: string;
  name: string;
  category: string;
  closeMode: string;
  campaigns: number;
  spend: number;
  roas: number;
}
/** Products present in an ad account (campaign-derived), with spend/ROAS for the range. */
export const getProductsInAccount = (account: string, range: string) =>
  getJSON<ProductInAccount[]>(
    `/api/products/in-account?account=${encodeURIComponent(account)}&range=${range}`,
  );
/** Aggregated audience profile for one product's creatives (null if no audience). */
export const getProductBreakdown = (sku: string, account: string, range: string) =>
  getJSON<AudienceProfile | null>(
    `/api/breakdown/product?sku=${encodeURIComponent(sku)}&account=${encodeURIComponent(account)}&range=${range}`,
  );
const campaignsPath = (range = "30d", custom?: { since: string; until: string } | null) => {
  const q = new URLSearchParams({ range });
  if (custom) {
    q.set("since", custom.since);
    q.set("until", custom.until);
  }
  return `/api/campaigns?${q.toString()}`;
};
export const getCampaigns = (range = "30d", custom?: { since: string; until: string } | null) =>
  getJSON<Campaign[]>(campaignsPath(range, custom));
/** Last campaigns payload for instant first paint (stale — always revalidate). */
export const peekCampaigns = (range = "30d", custom?: { since: string; until: string } | null) =>
  peek<Campaign[]>(campaignsPath(range, custom));

const creativesPath = (range = "30d", account = "all") =>
  `/api/creatives?range=${range}&account=${encodeURIComponent(account)}`;
/** Post-deduped, 30d-gated creatives, scoped to the given account (metaAccountId | "all"). */
export const getCreatives = (range = "30d", account = "all") =>
  getJSON<Creative[]>(creativesPath(range, account));
/** Last creatives payload for instant first paint (stale — always revalidate). */
export const peekCreatives = (range = "30d", account = "all") =>
  peek<Creative[]>(creativesPath(range, account));
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
/** A staged campaign edit to commit to Meta: an on/off flip and/or a new daily budget (THB). */
export interface CampaignChange {
  id: string; // metaCampaignId
  status?: "ACTIVE" | "PAUSED";
  dailyThb?: number;
}
export interface CampaignChangeResult {
  id: string;
  ok: boolean;
  error?: string;
}
/** Batch-commit staged campaign edits (on/off + budget) through the guarded POST write path. */
export async function applyCampaignChanges(
  changes: CampaignChange[],
): Promise<CampaignChangeResult[]> {
  const res = await fetch("/api/campaigns/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    results?: CampaignChangeResult[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `apply failed (${res.status})`);
  return data.results ?? [];
}

export const getLogs = () => getJSON<LogEntry[]>("/api/logs");
/** Last logs payload for instant first paint (stale — always revalidate). */
export const peekLogs = () => peek<LogEntry[]>("/api/logs");
export const getNotifications = () => getJSON<Notification[]>("/api/notifications");
export const getCategories = () => getJSON<Category[]>("/api/categories");
export const getSettings = () =>
  getJSON<{ connected: ConnectionAccount[]; available: AvailableAccount[] }>("/api/settings");
