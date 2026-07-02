/**
 * Thin Meta Graph API client. Server-only.
 * - Base url from META_API_VERSION.
 * - Token passed in by the caller (lib/meta/auth.ts resolves it).
 * - Parses Graph errors → MetaApiError.
 * - Reads X-Business-Use-Case-Usage (BUC) and backs off near the per-account quota.
 * - Cursor paging helper.
 */
const VERSION = process.env.META_API_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
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

/** Back off if any BUC metric is near 100% or Meta tells us to wait. */
async function honorRateLimit(res: Response): Promise<void> {
  const raw = res.headers.get("x-business-use-case-usage");
  if (!raw) return;
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
    if (waitMs > 0) await sleep(Math.min(waitMs, 60_000));
    else if (worst >= 90) await sleep(3_000);
  } catch {
    /* header not parseable — ignore */
  }
}

async function parse<T>(res: Response): Promise<T> {
  await honorRateLimit(res);
  const json = (await res.json()) as T & { error?: { message: string; code?: number; error_subcode?: number } };
  if (!res.ok || (json as { error?: unknown }).error) {
    const e = (json as { error?: { message: string; code?: number; error_subcode?: number } }).error;
    throw new MetaApiError(e?.message ?? `Graph API ${res.status}`, e?.code, e?.error_subcode);
  }
  return json as T;
}

export async function graphGet<T>(path: string, params: Params, token: string): Promise<T> {
  const res = await fetch(buildUrl(path, params, token), { cache: "no-store" });
  return parse<T>(res);
}

export async function graphPost<T>(path: string, body: Params, token: string): Promise<T> {
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
