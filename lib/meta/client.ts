/**
 * Thin Meta Graph API client. Server-only.
 * - Base url from META_API_VERSION.
 * - Token passed in by the caller (lib/meta/auth.ts resolves it).
 * - Parses Graph errors → MetaApiError.
 * - Reads X-Business-Use-Case-Usage (BUC) and backs off near the per-account quota.
 * - Retries transient / rate-limit errors with exponential backoff + jitter.
 * - Cursor paging helper + batch endpoint helper.
 */
const VERSION = process.env.META_API_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

/**
 * Spread into every insights request that reads conversions (purchase_roas / actions /
 * cost_per_action_type). Returns results under the ad set's configured attribution
 * setting — the same basis Ads Manager / Business Suite display — so ROAS, purchases and
 * CPA match 1:1 instead of the API's legacy default window.
 */
export const UNIFIED_ATTRIBUTION = { use_unified_attribution_setting: true } as const;

export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  httpStatus?: number;
  /** From the BUC header's estimated_time_to_regain_access — Meta's own retry hint. */
  retryAfterMs?: number;
  constructor(
    message: string,
    code?: number,
    subcode?: number,
    extra?: { httpStatus?: number; retryAfterMs?: number },
  ) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
    this.httpStatus = extra?.httpStatus;
    this.retryAfterMs = extra?.retryAfterMs;
  }
}

type Params = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, params: Params, token: string): string {
  const url = new URL(BASE + (path.startsWith("/") ? path : "/" + path));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("access_token", token);
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BucUsage {
  worst: number; // highest of call_count / total_cputime / total_time (% of quota)
  waitMs: number; // estimated_time_to_regain_access, ms (0 = not throttled)
}

/** Parse the X-Business-Use-Case-Usage header (per-account BUC quota metrics). */
function readUsage(res: Response): BucUsage | null {
  const raw = res.headers.get("x-business-use-case-usage");
  if (!raw) return null;
  try {
    const byAccount = JSON.parse(raw) as Record<
      string,
      { call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number }[]
    >;
    let worst = 0;
    let waitMs = 0;
    for (const entries of Object.values(byAccount)) {
      for (const e of entries) {
        worst = Math.max(worst, e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0);
        if (e.estimated_time_to_regain_access) {
          waitMs = Math.max(waitMs, e.estimated_time_to_regain_access * 1000);
        }
      }
    }
    return { worst, waitMs };
  } catch {
    return null; // header not parseable — ignore
  }
}

/** Back off if any BUC metric is near 100% or Meta tells us to wait. */
async function honorRateLimit(usage: BucUsage | null): Promise<void> {
  if (!usage) return;
  if (usage.waitMs > 0) await sleep(Math.min(usage.waitMs, 60_000));
  else if (usage.worst >= 90) await sleep(3_000);
  // Soft pacing: nearing the quota — slow down before Meta forces us to.
  else if (usage.worst >= 80) await sleep(1_000);
}

/**
 * Transient Graph errors worth retrying:
 *  - 4 (app-level throttle), 17 (user/account throttle), 32 (page throttle), 613 (custom throttle)
 *  - 80000–80009 (BUC rate limits per surface: ads_insights, ads_management, …)
 *  - HTTP 5xx without a Graph error body, and network-level fetch failures.
 */
const RETRYABLE_CODES = new Set([4, 17, 32, 613]);

function isTransient(e: unknown): boolean {
  if (e instanceof MetaApiError) {
    if (e.code !== undefined) {
      return RETRYABLE_CODES.has(e.code) || (e.code >= 80000 && e.code <= 80009);
    }
    return (e.httpStatus ?? 0) >= 500;
  }
  return e instanceof TypeError; // fetch network failure
}

/**
 * Retry transient failures with exponential backoff + jitter, honoring Meta's own
 * retry hint when present. If Meta says the account is throttled for >60s, fail fast
 * instead of eating the route's time budget — the nightly cron catches up.
 *
 * Retrying POSTs is safe here: our only mutations set absolute values
 * (status=…, daily_budget=…), so a duplicate write is idempotent. Keep it that way —
 * do not route non-idempotent mutations through this client without revisiting.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransient(e) || attempt === tries - 1) throw e;
      const hinted = e instanceof MetaApiError ? e.retryAfterMs : undefined;
      if (hinted !== undefined && hinted > 60_000) throw e;
      const backoff = 1000 * 2 ** attempt + Math.random() * 500;
      await sleep(Math.min(hinted ?? backoff, 30_000));
    }
  }
  throw lastErr;
}

async function parse<T>(res: Response): Promise<T> {
  const usage = readUsage(res);
  await honorRateLimit(usage);
  let json: (T & { error?: { message: string; code?: number; error_subcode?: number } }) | undefined;
  try {
    json = (await res.json()) as T & { error?: { message: string; code?: number; error_subcode?: number } };
  } catch {
    // Non-JSON body (e.g. a 502 HTML page) — surface as a retryable HTTP error.
    throw new MetaApiError(`Graph API ${res.status}`, undefined, undefined, {
      httpStatus: res.status,
      retryAfterMs: usage?.waitMs || undefined,
    });
  }
  if (!res.ok || (json as { error?: unknown }).error) {
    const e = (json as { error?: { message: string; code?: number; error_subcode?: number } }).error;
    throw new MetaApiError(e?.message ?? `Graph API ${res.status}`, e?.code, e?.error_subcode, {
      httpStatus: res.status,
      retryAfterMs: usage?.waitMs || undefined,
    });
  }
  return json as T;
}

export async function graphGet<T>(path: string, params: Params, token: string): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(buildUrl(path, params, token), { cache: "no-store" });
    return parse<T>(res);
  });
}

export async function graphPost<T>(path: string, body: Params, token: string): Promise<T> {
  return withRetry(async () => {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) form.set(k, String(v));
    }
    form.set("access_token", token);
    const res = await fetch(BASE + (path.startsWith("/") ? path : "/" + path), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    });
    return parse<T>(res);
  });
}

interface Paged<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

/** Follow cursor paging and return all rows (bounded by maxPages). */
export async function graphGetAll<T>(
  path: string,
  params: Params,
  token: string,
  maxPages = 25,
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  // Honor a caller-supplied page size (Meta accepts up to 500 on most edges);
  // fall back to 100. Fewer pages ⇒ fewer round-trips.
  const limit = params.limit ?? 100;
  for (let page = 0; page < maxPages; page++) {
    const res = await graphGet<Paged<T>>(path, { ...params, after, limit }, token);
    out.push(...(res.data ?? []));
    after = res.paging?.cursors?.after;
    if (!after || !res.paging?.next) break;
  }
  return out;
}

export interface BatchRequest {
  method: "GET" | "POST";
  /** Relative to the versioned base, no leading slash — e.g. "123?fields=permalink_url". */
  relative_url: string;
  /** Form-encoded body for POST sub-requests — e.g. "daily_budget=30000". */
  body?: string;
}

export interface BatchResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Graph batch endpoint: up to 50 sub-requests per HTTP call, results mapped 1:1 to
 * the input order with per-sub-request error isolation (one failing item never fails
 * its siblings). NOTE: each sub-request still counts toward the BUC quota — batching
 * saves HTTP round-trips and wall-clock, NOT rate-limit budget.
 */
export async function graphBatch<T = unknown>(
  requests: BatchRequest[],
  token: string,
): Promise<BatchResult<T>[]> {
  const out: BatchResult<T>[] = [];
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50);
    const items = await withRetry(async () => {
      const form = new URLSearchParams();
      form.set("access_token", token);
      form.set("include_headers", "false");
      form.set("batch", JSON.stringify(chunk));
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        cache: "no-store",
      });
      return parse<({ code: number; body: string } | null)[]>(res);
    });
    for (const item of items) {
      if (!item) {
        // Meta returns null for sub-requests it never completed.
        out.push({ ok: false, status: 0, error: "batch item not completed" });
        continue;
      }
      let body: unknown;
      try {
        body = JSON.parse(item.body);
      } catch {
        body = undefined;
      }
      const err = (body as { error?: { message?: string } } | undefined)?.error;
      if (item.code >= 200 && item.code < 300 && !err) {
        out.push({ ok: true, status: item.code, data: body as T });
      } else {
        out.push({ ok: false, status: item.code, error: err?.message ?? `HTTP ${item.code}` });
      }
    }
  }
  return out;
}

/**
 * Run `fn` over `items` with at most `limit` promises in flight. Preserves input
 * order in the result. Used to fan out per-account / per-window Graph calls without
 * blasting the API (or the DB pool) all at once.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runner = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, runner);
  await Promise.all(workers);
  return results;
}

export { VERSION as META_API_VERSION };
