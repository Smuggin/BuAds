/**
 * Pure grouping/sorting/judging for the Campaigns view. Combines the engine
 * (lib/kpi) with the store's override maps; framework-agnostic + testable.
 * Verdicts/state are derived here on every call, so a threshold edit re-judges all.
 */
import type {
  AccountKey,
  Campaign,
  CloseMode,
  MetricKey,
  Product,
  ScaleThresholds,
  Thresholds,
  Verdict,
} from "@/data/types";
import { accountMetaFor, KPI_METRIC_DEFS, METRIC_DEFS, RAMP } from "./constants";
import { fmtMetric } from "./format";
import {
  effBudget,
  effCloseMode,
  effScaleThresholds,
  effSkipMetrics,
  effThresholds,
} from "./resolvers";
import {
  evalCampaign,
  resolveCampaignState,
  verdictMeta,
  type CampaignState,
  type EvalResult,
} from "./kpi";

export type GroupBy = "product" | "account" | "status" | "none";
export type GroupSort = "perf" | "name";
export type SortDir = "asc" | "desc";
export type CampSortKey = MetricKey | "name" | "status" | "open" | "budget";
/** A row's status bucket: its KPI verdict while running, or "paused" when off. */
export type StatusBucket = Verdict | "paused";

/** Multi-select campaign filters (ephemeral UI state). Empty array = no constraint. */
export interface CampFilters {
  status: Verdict[]; // scale | interesting | running | breach
  onOff: ("on" | "off")[];
  skus: string[]; // product SKUs
  close: CloseMode[]; // OFF | SUGGEST | AUTO
  query: string; // campaign-name search
}

export const EMPTY_CAMP_FILTERS: CampFilters = {
  status: [],
  onOff: [],
  skus: [],
  close: [],
  query: "",
};

/** True when any filter dimension is active (used to show the active-filter row). */
export function hasActiveFilters(f: CampFilters): boolean {
  return (
    f.status.length > 0 ||
    f.onOff.length > 0 ||
    f.skus.length > 0 ||
    f.close.length > 0 ||
    f.query.trim().length > 0
  );
}

export interface ResolvedRow {
  campaign: Campaign;
  product: Product | null;
  thresholds: Thresholds | null;
  evalResult: EvalResult;
  state: CampaignState;
  budget: number;
  budgetChanged: boolean;
  statusRank: number; // scale 3 · interesting 2 · running 1 · breach 0
  detail: string;
  prodTh: string;
  accTh: string;
  closeMode: CloseMode | null; // the row's effective close policy (null when unmapped)
  unmapped: boolean; // no product mapped yet (live Meta campaigns) — shown without judging
}

export interface CampaignGroup {
  kind: GroupBy;
  key: string;
  title: string;
  subtitle: string;
  initials: string;
  color: string;
  scale: number; // verdict === "scale" (ควรสเกล)
  marked: number; // verdict === "interesting" (น่าสนใจ)
  active: number; // campaigns currently ON (running)
  closed: number;
  count: number;
  hasAuto: boolean;
  closeMode: CloseMode | null; // product groups carry their close policy
  thresholds: Thresholds | null; // product groups show ≥/≤ values in headers
  rows: ResolvedRow[];
}

export interface BuildParams {
  campaigns: Campaign[];
  products: Product[];
  groupBy: GroupBy;
  groupSort: GroupSort;
  groupDir: SortDir;
  campSort: CampSortKey;
  campDir: SortDir;
  prodThr: Record<string, Partial<Thresholds>>;
  prodScale: Record<string, ScaleThresholds>;
  closeOverride: Record<string, CloseMode>;
  skipOverride: Record<string, MetricKey[]>;
  budgetOverride: Record<string, number>;
  campOverride: Record<string, boolean>;
  filters?: CampFilters; // multi-select filters; omitted/empty = show everything
}

export interface BuildResult {
  groups: CampaignGroup[];
  summary: { scale: number; marked: number; running: number; breach: number; closed: number };
  total: number; // campaigns before filtering (for the "N of M" count)
  shown: number; // campaigns after filtering
}

/** Order status buckets scale → interesting → running → breach → paused. */
const BUCKET_ORDER: StatusBucket[] = ["scale", "interesting", "running", "breach", "paused"];

/** A resolved row's status bucket (verdict while on, "paused" when off). */
function rowBucket(r: ResolvedRow): StatusBucket {
  return r.state.on ? r.evalResult.verdict : "paused";
}

/** Apply the active multi-select filters to a resolved row. */
function matchesFilters(r: ResolvedRow, f: CampFilters): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !r.campaign.name.toLowerCase().includes(q)) return false;
  if (f.status.length && !f.status.includes(r.evalResult.verdict)) return false;
  if (f.onOff.length && !f.onOff.includes(r.state.on ? "on" : "off")) return false;
  if (f.skus.length && !(r.product && f.skus.includes(r.product.sku))) return false;
  if (f.close.length && !(r.closeMode !== null && f.close.includes(r.closeMode))) return false;
  return true;
}

function resolveRow(c: Campaign, p: Product | null, params: BuildParams): ResolvedRow {
  if (!p) {
    // unmapped live campaign — display raw metrics, no judging
    const cells = METRIC_DEFS.map((m) => ({
      key: m.key,
      value: c.metrics[m.key],
      disp: fmtMetric(m.key, c.metrics[m.key]),
      ok: true,
      enforced: true,
      tier: "ok" as const,
    }));
    const metaActive = c.status === "ACTIVE";
    const on = params.campOverride[c.id] ?? metaActive;
    return {
      campaign: c,
      product: null,
      thresholds: null,
      evalResult: { cells, breaches: 0, passAll: true, scaleReached: 0, verdict: "running" },
      state: {
        shouldClose: false,
        shouldScale: false,
        defaultOn: metaActive,
        on,
        statusLabel: on ? "ยังไม่จับคู่" : "ปิดอยู่",
        statusColor: "#6b7280",
        statusIcon: on ? "●" : "⏸",
      },
      budget: effBudget(c, params.budgetOverride),
      budgetChanged: false,
      statusRank: 1,
      detail: "ยังไม่ได้จับคู่กับสินค้า — เลือกสินค้าเพื่อให้ระบบตัดสิน",
      prodTh: "—",
      accTh: accountMetaFor(c.account).th,
      closeMode: null,
      unmapped: true,
    };
  }
  const thresholds = effThresholds(p, params.prodThr);
  const closeMode = effCloseMode(p, params.closeOverride);
  const advise = closeMode !== "OFF";
  const evalResult = evalCampaign(
    c.metrics,
    thresholds,
    effSkipMetrics(p, params.skipOverride),
    effScaleThresholds(p, params.prodScale, params.prodThr),
  );
  const state = resolveCampaignState(
    evalResult.verdict,
    advise,
    params.campOverride[c.id],
    c.status === "ACTIVE",
  );
  const budget = effBudget(c, params.budgetOverride);
  const ov = params.budgetOverride[c.id];
  const budgetChanged = ov != null && ov !== c.budget;
  const statusRank =
    evalResult.verdict === "scale"
      ? 3
      : evalResult.verdict === "interesting"
        ? 2
        : evalResult.verdict === "running"
          ? 1
          : 0;
  const detail =
    evalResult.verdict === "scale"
      ? "ทุกเกณฑ์ถึงเป้าสเกล · พร้อม Scale"
      : evalResult.verdict === "interesting"
        ? `ผ่านทุกเกณฑ์ · ถึงเป้าสเกล ${evalResult.scaleReached} รายการ`
        : evalResult.verdict === "breach"
          ? `เกินเกณฑ์ ${evalResult.breaches} รายการ${advise ? " · แนะนำให้ปิด" : " · รอตรวจสอบ"}`
          : "อยู่ในเกณฑ์ที่ตั้งไว้";
  return {
    campaign: c,
    product: p,
    thresholds,
    evalResult,
    state,
    budget,
    budgetChanged,
    statusRank,
    detail,
    prodTh: p.th,
    accTh: accountMetaFor(c.account).th,
    closeMode,
    unmapped: false,
  };
}

function sortRows(rows: ResolvedRow[], key: CampSortKey, dir: SortDir): ResolvedRow[] {
  const d = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return a.campaign.name.localeCompare(b.campaign.name) * d;
    if (key === "status") return (a.statusRank - b.statusRank) * d;
    if (key === "open") return ((a.state.on ? 1 : 0) - (b.state.on ? 1 : 0)) * d;
    if (key === "budget") return (a.budget - b.budget) * d;
    return (a.campaign.metrics[key] - b.campaign.metrics[key]) * d;
  });
}

export function buildCampaignGroups(params: BuildParams): BuildResult {
  const { campaigns, products, groupBy } = params;
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const allRows = campaigns.map((c) => resolveRow(c, bySku.get(c.sku) ?? null, params));

  // summary across ALL campaigns (counts stay totals, unaffected by the filters below)
  const summary = { scale: 0, marked: 0, running: 0, breach: 0, closed: 0 };
  for (const r of allRows) {
    if (!r.state.on) summary.closed++;
    else if (r.statusRank === 3) summary.scale++;
    else if (r.statusRank === 2) summary.marked++;
    else if (r.statusRank === 1) summary.running++;
    else summary.breach++;
  }

  // narrow to the rows matching the active filters, then group only those
  const filters = params.filters ?? EMPTY_CAMP_FILTERS;
  const rows = allRows.filter((r) => matchesFilters(r, filters));

  // assemble groups
  let groups: CampaignGroup[];
  if (groupBy === "none") {
    groups = [makeGroup("none", "all", rows, null, products)];
  } else if (groupBy === "account") {
    const map = new Map<AccountKey, ResolvedRow[]>();
    for (const r of rows) {
      const k = r.campaign.account;
      let arr = map.get(k);
      if (!arr) {
        arr = [];
        map.set(k, arr);
      }
      arr.push(r);
    }
    groups = [...map.entries()].map(([k, rs]) => makeGroup("account", k, rs, null, products));
  } else if (groupBy === "status") {
    const map = new Map<StatusBucket, ResolvedRow[]>();
    for (const r of rows) {
      const k = rowBucket(r);
      let arr = map.get(k);
      if (!arr) {
        arr = [];
        map.set(k, arr);
      }
      arr.push(r);
    }
    groups = BUCKET_ORDER.filter((b) => map.has(b)).map((b) => makeStatusGroup(b, map.get(b)!));
  } else {
    groups = products.map((p) =>
      makeGroup(
        "product",
        p.sku,
        rows.filter((r) => r.product?.sku === p.sku),
        p,
        products,
        effCloseMode(p, params.closeOverride),
      ),
    );
    const unmapped = rows.filter((r) => r.unmapped);
    if (unmapped.length) groups.push(makeUnmappedGroup(unmapped));
  }

  // product/status grouping can leave empty groups (a product with no matching
  // rows after filtering) — drop them so the list only shows populated groups.
  if (groupBy === "product" || groupBy === "status") groups = groups.filter((g) => g.count > 0);

  // sort rows within each group
  for (const g of groups) g.rows = sortRows(g.rows, params.campSort, params.campDir);
  const gd = params.groupDir === "asc" ? 1 : -1;
  if (groupBy === "status") {
    // status groups keep their canonical bucket order; groupDir just reverses it
    if (params.groupDir === "asc") groups.reverse();
  } else {
    const score = (g: CampaignGroup) =>
      g.rows.length ? g.rows.reduce((s, r) => s + r.statusRank, 0) / g.rows.length : 0;
    groups.sort((a, b) =>
      params.groupSort === "name"
        ? a.title.localeCompare(b.title) * gd
        : (score(a) - score(b)) * gd,
    );
  }

  return { groups, summary, total: allRows.length, shown: rows.length };
}

function makeGroup(
  kind: GroupBy,
  key: string,
  rows: ResolvedRow[],
  product: Product | null,
  products: Product[],
  closeMode: CloseMode | null = null,
): CampaignGroup {
  const scale = rows.filter((r) => r.statusRank === 3).length;
  const marked = rows.filter((r) => r.statusRank === 2).length;
  const active = rows.filter((r) => r.state.on).length;
  const closed = rows.filter((r) => !r.state.on).length;
  const count = rows.length;

  if (kind === "account") {
    const meta = accountMetaFor(key);
    return {
      kind, key, scale, marked, active, closed, count, rows,
      title: meta.th,
      subtitle: `${meta.en} · ${count} แคมเปญ`,
      initials: meta.initials,
      color: meta.color,
      hasAuto: false,
      closeMode: null,
      thresholds: null,
    };
  }
  if (kind === "product" && product) {
    const pi = products.findIndex((p) => p.sku === product.sku);
    return {
      kind, key, scale, marked, active, closed, count, rows,
      title: product.th,
      subtitle: `${product.sku} · ${count} แคมเปญ`,
      initials: product.sku.slice(0, 2),
      color: RAMP[pi % RAMP.length],
      hasAuto: true,
      closeMode,
      thresholds: rows[0]?.thresholds ?? product.thresholds,
    };
  }
  return {
    kind: "none", key, scale, marked, active, closed, count, rows,
    title: "ทุกแคมเปญ",
    subtitle: `ทุกบัญชี ทุกสินค้า · ${count} แคมเปญ`,
    initials: "∑",
    color: "#6b7280",
    hasAuto: false,
    closeMode: null,
    thresholds: null,
  };
}

/** Group header for a status bucket (used by groupBy === "status"). */
function makeStatusGroup(bucket: StatusBucket, rows: ResolvedRow[]): CampaignGroup {
  const meta =
    bucket === "paused"
      ? { label: "ปิดอยู่", en: "Paused", icon: "⏸", color: "#6b7280" }
      : { ...verdictMeta(bucket), en: STATUS_EN[bucket] };
  return {
    kind: "none",
    key: `__status_${bucket}__`,
    title: `${meta.icon} ${meta.label} · ${meta.en}`,
    subtitle: `${rows.length} แคมเปญ`,
    initials: meta.icon,
    color: meta.color,
    scale: rows.filter((r) => r.statusRank === 3).length,
    marked: rows.filter((r) => r.statusRank === 2).length,
    active: rows.filter((r) => r.state.on).length,
    closed: rows.filter((r) => !r.state.on).length,
    count: rows.length,
    hasAuto: false,
    closeMode: null,
    thresholds: null,
    rows,
  };
}

/** English labels for verdict buckets (Thai comes from verdictMeta). */
const STATUS_EN: Record<Verdict, string> = {
  scale: "Should scale",
  interesting: "Interesting",
  running: "Running",
  breach: "Should close",
};

function makeUnmappedGroup(rows: ResolvedRow[]): CampaignGroup {
  return {
    kind: "none",
    key: "__unmapped__",
    title: "ยังไม่จับคู่สินค้า · Unmapped",
    subtitle: `แคมเปญที่ยังไม่ได้ผูกกับสินค้า · ${rows.length} แคมเปญ`,
    initials: "?",
    color: "#9aa0a8",
    scale: 0,
    marked: 0,
    active: rows.filter((r) => r.state.on).length,
    closed: rows.filter((r) => !r.state.on).length,
    count: rows.length,
    hasAuto: false,
    closeMode: null,
    thresholds: null,
    rows,
  };
}

/** Build a synthetic "action" group (a pinned, cross-cutting list of rows). */
function actionGroup(
  key: string,
  title: string,
  color: string,
  icon: string,
  subtitlePrefix: string,
  rows: ResolvedRow[],
): CampaignGroup {
  return {
    kind: "none",
    key,
    title,
    subtitle: `${subtitlePrefix} · ${rows.length} แคมเปญ`,
    initials: icon,
    color,
    scale: rows.filter((r) => r.statusRank === 3).length,
    marked: rows.filter((r) => r.statusRank === 2).length,
    active: rows.filter((r) => r.state.on).length,
    closed: rows.filter((r) => !r.state.on).length,
    count: rows.length,
    hasAuto: false,
    closeMode: null,
    thresholds: null,
    rows,
  };
}

/** Synthetic "should close" group: active campaigns breaching their KPIs whose
 *  product close policy is SUGGEST/AUTO (state.shouldClose). null when none. */
export function shouldCloseGroup(groups: CampaignGroup[]): CampaignGroup | null {
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.state.shouldClose);
  if (!rows.length) return null;
  return actionGroup(
    "__should_close__",
    "⚠ ควรปิด · Should close",
    "#d6453d",
    "⚠",
    "แคมเปญที่เกินเกณฑ์และยังเปิดอยู่",
    rows,
  );
}

/**
 * Pinned "action needed" groups shown above the normal groups, ordered best → worst:
 * ควรสเกล → น่าสนใจ → ควรปิด → ยังเปิดทั้งที่เกินเกณฑ์. They pin in the product / account /
 * none views (a campaign can appear both pinned and in its normal group, like ควรปิด
 * always has). Skipped in the "by status" view, where those buckets already exist.
 */
export function pinnedActionGroups(groups: CampaignGroup[], groupBy: GroupBy): CampaignGroup[] {
  const rows = groups.flatMap((g) => g.rows);
  const out: CampaignGroup[] = [];
  const extras = groupBy !== "status";

  if (extras) {
    const scale = rows.filter((r) => r.state.shouldScale);
    if (scale.length)
      out.push(
        actionGroup(
          "__should_scale__",
          "⤴ ควรสเกล · Should scale",
          "#1f8a5b",
          "⤴",
          "แคมเปญที่ถึงเป้าสเกลและยังเปิดอยู่",
          scale,
        ),
      );
    const interesting = rows.filter(
      (r) => r.state.on && r.evalResult.verdict === "interesting",
    );
    if (interesting.length)
      out.push(
        actionGroup(
          "__interesting__",
          "★ น่าสนใจ · Interesting",
          "#c98a16",
          "★",
          "ผ่านทุกเกณฑ์และถึงเป้าสเกลบางส่วน",
          interesting,
        ),
      );
  }

  const close = shouldCloseGroup(groups);
  if (close) out.push(close);

  if (extras) {
    // breaching + still running but close policy is OFF, so not in the ควรปิด advisory
    const breachOff = rows.filter(
      (r) => r.state.on && r.evalResult.verdict === "breach" && !r.state.shouldClose,
    );
    if (breachOff.length)
      out.push(
        actionGroup(
          "__breach_open__",
          "⚠ ยังเปิดทั้งที่เกินเกณฑ์ · Breaching (policy off)",
          "#c05746",
          "⚠",
          "เกินเกณฑ์แต่ปิดนโยบายอัตโนมัติไว้ (OFF)",
          breachOff,
        ),
      );
  }

  return out;
}

// Campaign table shows exactly the KPIs configured on the Product-KPI page (shared
// KPI_METRIC_DEFS: no CPA, no Cost/วัน). Daily spend still surfaces via the งบ/วัน column.
export { KPI_METRIC_DEFS as CAMPAIGN_METRIC_DEFS };
