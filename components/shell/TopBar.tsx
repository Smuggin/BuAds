"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RANGES, TITLES } from "@/lib/constants";
import { getAccounts, getBreakdownAccounts, type AccountOption } from "@/lib/api";
import { useAppStore } from "@/store/AppProvider";
import { NotificationsBell } from "./NotificationsBell";

function titleFor(pathname: string): [string, string] {
  if (pathname === "/" ) return TITLES["/overview"];
  const key = Object.keys(TITLES).find((href) => pathname.startsWith(href));
  return key ? TITLES[key] : TITLES["/overview"];
}

export function TopBar() {
  const pathname = usePathname();
  const [title, sub] = titleFor(pathname);
  const range = useAppStore((s) => s.range);
  const setRange = useAppStore((s) => s.setRange);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const setAccountFilter = useAppStore((s) => s.setAccountFilter);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  // On the Breakdown page, accounts with no report for the current range are
  // disabled (like the page's old in-view picker). null = no restriction.
  const onBreakdown = pathname.startsWith("/breakdown");
  const [available, setAvailable] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    getAccounts().then((a) => alive && setAccounts(a)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!onBreakdown) return;
    let alive = true;
    getBreakdownAccounts(range).then((ids) => alive && setAvailable(ids)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [onBreakdown, range]);

  const hasReport = (id: string) => !onBreakdown || available === null || available.includes(id);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#e4e7ec] bg-page-bg/[0.86] px-[26px] py-[14px] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-[14px]">
        <div>
          <div className="text-page-title">{title}</div>
          <div className="text-[12px] text-muted">{sub}</div>
        </div>
      </div>

      <div className="flex items-center gap-[10px]">
        <div className="flex items-center gap-[7px] rounded-control border border-[#dde1e7] bg-card pl-[11px] pr-1 text-[12.5px] font-medium text-ink">
          <span className="h-[7px] w-[7px] rounded-full bg-success" />
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="cursor-pointer border-none bg-transparent py-2 pr-1 text-[12.5px] font-medium text-ink focus:outline-none"
          >
            <option value="all">ทุกบัญชี · All accounts ({accounts.length})</option>
            {accounts.map((a) => {
              const ok = hasReport(a.id);
              return (
                <option key={a.id} value={a.id} disabled={!ok}>
                  {a.name}
                  {ok ? "" : " · ไม่มีรายงาน"}
                </option>
              );
            })}
          </select>
        </div>

        {/* date range */}
        <div className="flex rounded-control border border-[#dde1e7] bg-card p-[3px]" role="group" aria-label="ช่วงเวลา">
          {RANGES.map((r) => {
            const on = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => setRange(r.id)}
                className={`num rounded-[7px] px-3 py-[5px] text-[12px] font-semibold transition-colors duration-bg ${
                  on ? "bg-ink text-white" : "bg-transparent text-muted"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <NotificationsBell />

        <button
          type="button"
          className="rounded-control border-none bg-ink px-[15px] py-[9px] text-[12.5px] font-medium text-white"
        >
          รายงาน Export
        </button>
      </div>
    </header>
  );
}
