/**
 * Pure grouping/sorting/judging for the Campaigns view. Combines the engine
 * (lib/kpi) with the store's override maps; framework-agnostic + testable.
 * Verdicts/state are derived here on every call, so a threshold edit re-judges all.
 */
import type {
  AccountKey,
  Campaign,
  MetricKey,
  Product,
  Thresholds,
} from "@/data/types";
import { ACCOUNT_META, METRIC_DEFS, RAMP } from "./constants";
import { effAutoClose, effBudget, effThresholds } from "./resolvers";
import { evalCampaign, resolveCampaignState, type CampaignState, type EvalResult } from "./kpi";

export type GroupBy = "product" | "account" | "none";
export type GroupSort = "perf" | "name";
export type SortDir = "asc" | "desc";
export type CampSortKey = MetricKey | "name" | "status" | "open" | "budget";

export interface ResolvedRow {
  campaign: Campaign;
  product: Product;
  thresholds: Thresholds;
  evalResult: EvalResult;
  state: CampaignState;
  budget: number;
  budgetChanged: boolean;
  statusRank: number; // marked 2 · running 1 · breach 0
  detail: string;
  prodTh: string;
  accTh: string;
}

export interface CampaignGroup {
  kind: GroupBy;
  key: string;
  title: string;
  subtitle: string;
  initials: string;
  color: string;
  marked: number;
  closed: number;
  count: number;
  hasAuto: boolean;
  autoOn: boolean;
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
  autoOverride: Record<string, boolean>;
  budgetOverride: Record<string, number>;
  campOverride: Record<string, boolean>;
}

export interface BuildResult {
  groups: CampaignGroup[];
  summary: { marked: number; running: number; closed: number };
}

function resolveRow(c: Campaign, p: Product, params: BuildParams): ResolvedRow {
  const thresholds = effThresholds(p, params.prodThr);
  const auto = effAutoClose(p, params.autoOverride);
  const evalResult = evalCampaign(c.metrics, thresholds);
  const state = resolveCampaignState(evalResult.verdict, auto, params.campOverride[c.id]);
  const budget = effBudget(c, params.budgetOverride);
  const ov = params.budgetOverride[c.id];
  const budgetChanged = ov != null && ov !== c.budget;
  const statusRank =
    evalResult.verdict === "marked" ? 2 : evalResult.verdict === "running" ? 1 : 0;
  const detail =
    evalResult.verdict === "marked"
      ? "ROAS เกินเกณฑ์ · พร้อม Scale"
      : evalResult.verdict === "breach"
        ? `เกินเกณฑ์ ${evalResult.breaches} รายการ${auto ? " · ปิดให้แล้ว" : " · รอตรวจสอบ"}`
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
    accTh: ACCOUNT_META[c.account].th,
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
  const rows = campaigns
    .map((c) => {
      const p = bySku.get(c.sku);
      return p ? resolveRow(c, p, params) : null;
    })
    .filter((r): r is ResolvedRow => r !== null);

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
        rows.filter((r) => r.product.sku === p.sku),
        p,
        products,
        effAutoClose(p, params.autoOverride),
      ),
    );
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
  autoOn = false,
): CampaignGroup {
  const marked = rows.filter((r) => r.statusRank === 2).length;
  const closed = rows.filter((r) => !r.state.on).length;
  const count = rows.length;

  if (kind === "account") {
    const meta = ACCOUNT_META[key as AccountKey];
    return {
      kind, key, marked, closed, count, rows,
      title: meta.th,
      subtitle: `${meta.en} · ${count} แคมเปญ`,
      initials: meta.initials,
      color: meta.color,
      hasAuto: false,
      autoOn: false,
      thresholds: null,
    };
  }
  if (kind === "product" && product) {
    const pi = products.findIndex((p) => p.sku === product.sku);
    return {
      kind, key, marked, closed, count, rows,
      title: product.th,
      subtitle: `${product.en} · ${product.sku} · ${count} แคมเปญ`,
      initials: product.sku.slice(0, 2),
      color: RAMP[pi % RAMP.length],
      hasAuto: true,
      autoOn,
      thresholds: rows[0]?.thresholds ?? product.thresholds,
    };
  }
  return {
    kind: "none", key, marked, closed, count, rows,
    title: "ทุกแคมเปญ",
    subtitle: `ทุกบัญชี ทุกสินค้า · ${count} แคมเปญ`,
    initials: "∑",
    color: "#6b7280",
    hasAuto: false,
    autoOn: false,
    thresholds: null,
  };
}

export const CAMPAIGN_METRIC_DEFS = METRIC_DEFS;
