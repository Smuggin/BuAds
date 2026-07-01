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
  Thresholds,
} from "@/data/types";
import { accountMetaFor, METRIC_DEFS, RAMP } from "./constants";
import { fmtMetric } from "./format";
import { effBudget, effCloseMode, effSkipMetrics, effThresholds } from "./resolvers";
import { evalCampaign, resolveCampaignState, type CampaignState, type EvalResult } from "./kpi";

export type GroupBy = "product" | "account" | "none";
export type GroupSort = "perf" | "name";
export type SortDir = "asc" | "desc";
export type CampSortKey = MetricKey | "name" | "status" | "open" | "budget";

export interface ResolvedRow {
  campaign: Campaign;
  product: Product | null;
  thresholds: Thresholds | null;
  evalResult: EvalResult;
  state: CampaignState;
  budget: number;
  budgetChanged: boolean;
  statusRank: number; // marked 2 · running 1 · breach 0
  detail: string;
  prodTh: string;
  accTh: string;
  unmapped: boolean; // no product mapped yet (live Meta campaigns) — shown without judging
}

export interface CampaignGroup {
  kind: GroupBy;
  key: string;
  title: string;
  subtitle: string;
  initials: string;
  color: string;
  marked: number;
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
  closeOverride: Record<string, CloseMode>;
  skipOverride: Record<string, MetricKey[]>;
  budgetOverride: Record<string, number>;
  campOverride: Record<string, boolean>;
}

export interface BuildResult {
  groups: CampaignGroup[];
  summary: { marked: number; running: number; closed: number };
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
    }));
    const metaActive = c.status === "ACTIVE";
    const on = params.campOverride[c.id] ?? metaActive;
    return {
      campaign: c,
      product: null,
      thresholds: null,
      evalResult: { cells, breaches: 0, passAll: true, verdict: "running" },
      state: {
        shouldClose: false,
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
      unmapped: true,
    };
  }
  const thresholds = effThresholds(p, params.prodThr);
  const advise = effCloseMode(p, params.closeOverride) !== "OFF";
  const evalResult = evalCampaign(c.metrics, thresholds, effSkipMetrics(p, params.skipOverride));
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
    evalResult.verdict === "marked" ? 2 : evalResult.verdict === "running" ? 1 : 0;
  const detail =
    evalResult.verdict === "marked"
      ? "ROAS เกินเกณฑ์ · พร้อม Scale"
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
  const rows = campaigns.map((c) => resolveRow(c, bySku.get(c.sku) ?? null, params));

  // summary across all campaigns
  const summary = { marked: 0, running: 0, closed: 0 };
  for (const r of rows) {
    if (!r.state.on) summary.closed++;
    else if (r.statusRank === 2) summary.marked++;
    else summary.running++;
  }

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

  // sort rows within each group, and sort the groups
  for (const g of groups) g.rows = sortRows(g.rows, params.campSort, params.campDir);
  const gd = params.groupDir === "asc" ? 1 : -1;
  const score = (g: CampaignGroup) =>
    g.rows.length ? g.rows.reduce((s, r) => s + r.statusRank, 0) / g.rows.length : 0;
  groups.sort((a, b) =>
    params.groupSort === "name"
      ? a.title.localeCompare(b.title) * gd
      : (score(a) - score(b)) * gd,
  );

  return { groups, summary };
}

function makeGroup(
  kind: GroupBy,
  key: string,
  rows: ResolvedRow[],
  product: Product | null,
  products: Product[],
  closeMode: CloseMode | null = null,
): CampaignGroup {
  const marked = rows.filter((r) => r.statusRank === 2).length;
  const active = rows.filter((r) => r.state.on).length;
  const closed = rows.filter((r) => !r.state.on).length;
  const count = rows.length;

  if (kind === "account") {
    const meta = accountMetaFor(key);
    return {
      kind, key, marked, active, closed, count, rows,
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
      kind, key, marked, active, closed, count, rows,
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
    kind: "none", key, marked, active, closed, count, rows,
    title: "ทุกแคมเปญ",
    subtitle: `ทุกบัญชี ทุกสินค้า · ${count} แคมเปญ`,
    initials: "∑",
    color: "#6b7280",
    hasAuto: false,
    closeMode: null,
    thresholds: null,
  };
}

function makeUnmappedGroup(rows: ResolvedRow[]): CampaignGroup {
  return {
    kind: "none",
    key: "__unmapped__",
    title: "ยังไม่จับคู่สินค้า · Unmapped",
    subtitle: `แคมเปญที่ยังไม่ได้ผูกกับสินค้า · ${rows.length} แคมเปญ`,
    initials: "?",
    color: "#9aa0a8",
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

/** Synthetic "should close" group: active campaigns breaching their KPIs whose
 *  product close policy is SUGGEST/AUTO (state.shouldClose). null when none. */
export function shouldCloseGroup(groups: CampaignGroup[]): CampaignGroup | null {
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.state.shouldClose);
  if (!rows.length) return null;
  return {
    kind: "none",
    key: "__should_close__",
    title: "⚠ ควรปิด · Should close",
    subtitle: `แคมเปญที่เกินเกณฑ์และยังเปิดอยู่ · ${rows.length} แคมเปญ`,
    initials: "⚠",
    color: "#d6453d",
    marked: 0,
    active: rows.length, // all "should close" rows are still running
    closed: 0,
    count: rows.length,
    hasAuto: false,
    closeMode: null,
    thresholds: null,
    rows,
  };
}

export const CAMPAIGN_METRIC_DEFS = METRIC_DEFS;
