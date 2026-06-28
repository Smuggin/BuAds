/** Pure helpers for the Creatives view: account scoping + filtering. */
import type { AccountKey, Campaign, Creative } from "@/data/types";

export function creativeAccounts(cr: Creative, campaigns: Campaign[]): AccountKey[] {
  const set = new Set<AccountKey>();
  for (const cid of cr.campaigns) {
    const c = campaigns.find((x) => x.id === cid);
    if (c) set.add(c.account);
  }
  return [...set];
}

/** SKUs that have at least one creative present in the given account. */
export function skusInAccount(
  creatives: Creative[],
  campaigns: Campaign[],
  acc: AccountKey | "all",
): Set<string> {
  const set = new Set<string>();
  for (const cr of creatives) {
    if (acc === "all" || creativeAccounts(cr, campaigns).includes(acc)) set.add(cr.sku);
  }
  return set;
}

export function filterCreatives(
  creatives: Creative[],
  campaigns: Campaign[],
  acc: AccountKey | "all",
  prod: string,
): Creative[] {
  return creatives.filter(
    (cr) =>
      (prod === "all" || cr.sku === prod) &&
      (acc === "all" || creativeAccounts(cr, campaigns).includes(acc)),
  );
}
