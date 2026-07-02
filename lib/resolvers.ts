/**
 * Pure resolvers — merge seed/API values with the store's override maps.
 * Keep framework-agnostic so the engine and store share one source of truth.
 * See .ai/data-contracts.md §"Store-owned" and .ai/kpi-engine.md.
 */
import type {
  Campaign,
  Category,
  CloseMode,
  MetricKey,
  Product,
  ScaleThresholds,
  Thresholds,
} from "@/data/types";
import { deriveScaleThreshold, JUDGED_METRIC_KEYS, METRIC_DEFS } from "./constants";

/** Effective thresholds = product defaults overlaid with per-sku edits. */
export function effThresholds(
  product: Product,
  prodThr: Record<string, Partial<Thresholds>> = {},
): Thresholds {
  const o = prodThr[product.sku] ?? {};
  const t = {} as Thresholds;
  for (const m of METRIC_DEFS) {
    const key = m.key as MetricKey;
    t[key] = o[key] ?? product.thresholds[key];
  }
  return t;
}

/** Effective scale targets = product's stored scale overlaid with per-sku draft edits.
 *  Falls back to a value derived from the (effective) limit when a metric has none yet. */
export function effScaleThresholds(
  product: Product,
  prodScale: Record<string, ScaleThresholds> = {},
  prodThr: Record<string, Partial<Thresholds>> = {},
): ScaleThresholds {
  const draft = prodScale[product.sku] ?? {};
  const base = product.scaleThresholds ?? {};
  const limits = effThresholds(product, prodThr);
  const out: ScaleThresholds = {};
  for (const key of JUDGED_METRIC_KEYS) {
    out[key] = draft[key] ?? base[key] ?? deriveScaleThreshold(key, limits[key]);
  }
  return out;
}

export function effCloseMode(
  product: Product,
  closeOverride: Record<string, CloseMode> = {},
): CloseMode {
  return closeOverride[product.sku] ?? product.closeMode;
}

/** Effective skipped metrics = session override, else the product's stored set. */
export function effSkipMetrics(
  product: Product,
  skipOverride: Record<string, MetricKey[]> = {},
): MetricKey[] {
  return skipOverride[product.sku] ?? product.skipMetrics ?? [];
}

export function effBudget(
  campaign: Campaign,
  budgetOverride: Record<string, number> = {},
): number {
  return budgetOverride[campaign.id] ?? campaign.budget;
}

/** Effective product = base overlaid with catalog edits (name/cost/category/accounts/img). */
export function effProduct(
  product: Product,
  prodEdits: Record<string, Partial<Product>> = {},
): Product {
  const e = prodEdits[product.sku];
  return e ? { ...product, ...e } : product;
}

/** Built-in + custom categories, de-duped case-insensitively, built-ins first. */
export function allCategories(
  defaults: Category[],
  custom: Category[] = [],
): Category[] {
  const seen = new Set<string>();
  const out: Category[] = [];
  for (const c of [...defaults, ...custom]) {
    const key = c.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(c.trim());
    }
  }
  return out;
}

export function effRuleOn(
  rule: { id: string; on: boolean },
  ruleOverride: Record<string, boolean> = {},
): boolean {
  return ruleOverride[rule.id] ?? rule.on;
}

export function isConnected(
  account: { id: string; connected: boolean },
  connOverride: Record<string, boolean> = {},
): boolean {
  return connOverride[account.id] ?? account.connected;
}
