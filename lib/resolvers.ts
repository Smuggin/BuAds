/**
 * Pure resolvers — merge seed/API values with the store's override maps.
 * Keep framework-agnostic so the engine and store share one source of truth.
 * See .ai/data-contracts.md §"Store-owned" and .ai/kpi-engine.md.
 */
import type {
  Campaign,
  Category,
  MetricKey,
  Product,
  Thresholds,
} from "@/data/types";
import { METRIC_DEFS } from "./constants";

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

export function effAutoClose(
  product: Product,
  autoOverride: Record<string, boolean> = {},
): boolean {
  return autoOverride[product.sku] ?? product.autoClose;
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

export function isConnected(
  account: { id: string; connected: boolean },
  connOverride: Record<string, boolean> = {},
): boolean {
  return connOverride[account.id] ?? account.connected;
}
