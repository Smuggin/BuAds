"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { usePerfColor } from "@/store/AppProvider";
import type { OverviewAccountRow } from "@/data/types";

type SortKey = "name" | "spend" | "revenue" | "roas" | "purchases" | "cpa" | "ctr" | "status";
type SortDir = "asc" | "desc";

// Pull a comparable number out of a formatted cell ("฿1,234.5" → 1234.5).
const num = (v: string) => Number(v.replace(/[^0-9.-]/g, "")) || 0;

// Text columns sort ascending first; numeric columns show best (largest) first.
const firstDir = (key: SortKey): SortDir => (key === "name" || key === "status" ? "asc" : "desc");

/** Consolidated ad-accounts table — perf-colored ROAS, status chips, connect CTA. */
export function AccountsTable({ accounts }: { accounts: OverviewAccountRow[] }) {
  const pc = usePerfColor();
  const [sort, setSort] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<SortDir>("desc");

  const onSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(firstDir(key));
    }
  };

  const rows = useMemo(() => {
    if (!sort) return accounts;
    const cmp = (a: OverviewAccountRow, b: OverviewAccountRow) => {
      if (sort === "name" || sort === "status") return a[sort].localeCompare(b[sort]);
      return num(a[sort]) - num(b[sort]);
    };
    const sorted = [...accounts].sort(cmp);
    return dir === "asc" ? sorted : sorted.reverse();
  }, [accounts, sort, dir]);

  const arrow = (key: SortKey) => (sort === key ? (dir === "asc" ? "↑" : "↓") : "");

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-2 px-5 py-4">
        <div>
          <div className="text-section-title">บัญชีโฆษณาทั้งหมด · Ad accounts</div>
          <div className="text-[12px] text-muted">
            รวมทุกบัญชีไว้ที่เดียว — ไม่ต้องสลับสิบหน้าต่างอีกต่อไป
          </div>
        </div>
        <button
          type="button"
          className="rounded-input border border-[#e4e7ec] bg-[#f3f4f6] px-3 py-[7px] text-[12px] font-medium text-ink"
        >
          + เชื่อมบัญชี
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-field-bg text-[11px] uppercase tracking-[0.04em] text-muted">
              <Th sortKey="name" onSort={onSort} active={sort} arrow={arrow} align="left" pad="px-5">
                บัญชี · Account
              </Th>
              <Th sortKey="spend" onSort={onSort} active={sort} arrow={arrow}>Spend</Th>
              <Th sortKey="revenue" onSort={onSort} active={sort} arrow={arrow}>Revenue</Th>
              <Th sortKey="roas" onSort={onSort} active={sort} arrow={arrow}>ROAS</Th>
              <Th sortKey="purchases" onSort={onSort} active={sort} arrow={arrow}>Purch.</Th>
              <Th sortKey="cpa" onSort={onSort} active={sort} arrow={arrow}>CPA</Th>
              <Th sortKey="ctr" onSort={onSort} active={sort} arrow={arrow}>CTR</Th>
              <Th sortKey="status" onSort={onSort} active={sort} arrow={arrow} pad="px-5">
                Status
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const active = a.status === "Active";
              return (
                <tr key={a.name} className="border-t border-border-2">
                  <td className="px-5 py-[13px]">
                    <div className="leading-[1.25]">
                      <div className="font-semibold text-ink">{a.name}</div>
                      <div className="text-[11px] text-muted-2">{a.platform}</div>
                    </div>
                  </td>
                  <td className="num px-[14px] py-[13px] text-right text-ink-2">{a.spend}</td>
                  <td className="num px-[14px] py-[13px] text-right text-ink-2">{a.revenue}</td>
                  <td
                    className="num px-[14px] py-[13px] text-right font-semibold"
                    style={{ color: pc(parseFloat(a.roas)) }}
                  >
                    {a.roas}
                  </td>
                  <td className="num px-[14px] py-[13px] text-right text-ink-2">{a.purchases}</td>
                  <td className="num px-[14px] py-[13px] text-right text-ink-2">{a.cpa}</td>
                  <td className="num px-[14px] py-[13px] text-right text-ink-2">{a.ctr}</td>
                  <td className="px-5 py-[13px] text-right">
                    {active ? (
                      <StatusChip color="#1f8a5b" dot>
                        Active
                      </StatusChip>
                    ) : (
                      <StatusChip color="#838992" flatBg="#f0f1f3" dot>
                        Paused
                      </StatusChip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Clickable, sort-aware column header — accent + arrow when it's the active sort key. */
function Th({
  children,
  sortKey,
  onSort,
  active,
  arrow,
  align = "right",
  pad = "px-[14px]",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  active: SortKey | null;
  arrow: (key: SortKey) => string;
  align?: "left" | "right";
  pad?: string;
}) {
  const on = active === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`${pad} cursor-pointer select-none py-[10px] font-semibold ${
        align === "left" ? "text-left" : "text-right"
      } ${on ? "text-accent" : ""}`}
    >
      {children}
      <span className={`num ml-1 ${on ? "text-accent" : "text-[#c2c7cf]"}`}>{arrow(sortKey)}</span>
    </th>
  );
}
