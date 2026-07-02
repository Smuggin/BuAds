"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RANGES, TITLES } from "@/lib/constants";
import { getAccounts, getBreakdownAccounts, type AccountOption } from "@/lib/api";
import { useAppStore } from "@/store/AppProvider";
import type { RangeId } from "@/store/useAppStore";
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
  const customRange = useAppStore((s) => s.customRange);
  const applyRange = useAppStore((s) => s.applyRange);
  const syncProgress = useAppStore((s) => s.syncProgress);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const setAccountFilter = useAppStore((s) => s.setAccountFilter);

  const syncing = !!syncProgress;
  const today = new Date().toISOString().slice(0, 10);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const fmtShort = (iso: string) => iso.slice(5).replace("-", "/"); // "06-05" → "06/05"

  const pick = async (id: RangeId) => {
    try {
      await applyRange(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "โหลดช่วงเวลาไม่สำเร็จ");
    }
  };

  const openPicker = () => {
    if (!since) setSince(customRange?.since ?? today);
    if (!until) setUntil(customRange?.until ?? today);
    setPickerOpen((o) => !o);
  };

  const applyCustom = async () => {
    if (!since || !until) return;
    if (Date.parse(since) > Date.parse(until)) {
      alert("วันเริ่มต้องอยู่ก่อนวันสิ้นสุด · From must be on/before To");
      return;
    }
    const span = Math.floor((Date.parse(until) - Date.parse(since)) / 86_400_000) + 1;
    if (span > 90) {
      alert("ช่วงเวลาสูงสุด 90 วัน · Max range is 90 days");
      return;
    }
    setPickerOpen(false);
    try {
      await applyRange("custom", { since, until });
    } catch (e) {
      alert(e instanceof Error ? e.message : "โหลดช่วงเวลาไม่สำเร็จ");
    }
  };
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

  // The app boots on "today", but that window is only synced on demand (the
  // nightly schedule covers 7/30/90d) — refresh it once so the first paint
  // isn't yesterday's snapshot. applyRange no-ops if a sync is already running.
  const bootRefreshed = useRef(false);
  useEffect(() => {
    if (bootRefreshed.current || range !== "today") return;
    bootRefreshed.current = true;
    void applyRange("today").catch(() => {});
  }, [range, applyRange]);

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
        <div className="relative">
          <div className="flex rounded-control border border-[#dde1e7] bg-card p-[3px]" role="group" aria-label="ช่วงเวลา">
            {RANGES.map((r) => {
              const on = r.id === range;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  disabled={syncing}
                  onClick={() => pick(r.id)}
                  className={`num rounded-[7px] px-3 py-[5px] text-[12px] font-semibold transition-colors duration-bg disabled:opacity-50 ${
                    on ? "bg-ink text-white" : "bg-transparent text-muted"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={range === "custom"}
              disabled={syncing}
              onClick={openPicker}
              title="ช่วงเวลากำหนดเอง · Custom range"
              className={`num rounded-[7px] px-3 py-[5px] text-[12px] font-semibold transition-colors duration-bg disabled:opacity-50 ${
                range === "custom" ? "bg-ink text-white" : "bg-transparent text-muted"
              }`}
            >
              {range === "custom" && customRange
                ? `${fmtShort(customRange.since)}–${fmtShort(customRange.until)}`
                : "กำหนดเอง"}
            </button>
          </div>

          {pickerOpen && (
            <>
              <button
                type="button"
                aria-label="ปิด"
                onClick={() => setPickerOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-[44px] z-50 w-[248px] rounded-[12px] border border-[#e4e7ec] bg-card p-3 shadow-dropdown">
                <div className="text-[12.5px] font-semibold text-ink">ช่วงเวลากำหนดเอง · Custom range</div>
                <div className="mb-[10px] mt-[2px] text-[11px] text-muted">สูงสุด 90 วัน · max 90 days</div>
                <label className="mb-2 flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">
                  เริ่ม · From
                  <input
                    type="date"
                    max={today}
                    value={since}
                    onChange={(e) => setSince(e.target.value)}
                    className="num rounded-input border border-[#dde1e7] bg-card px-[10px] py-[7px] text-[12.5px] text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">
                  ถึง · To
                  <input
                    type="date"
                    max={today}
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    className="num rounded-input border border-[#dde1e7] bg-card px-[10px] py-[7px] text-[12.5px] text-ink"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="flex-1 rounded-input border border-[#dde1e7] bg-card py-[7px] text-[12px] font-semibold text-ink"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={applyCustom}
                    disabled={!since || !until}
                    className="flex-1 rounded-input bg-accent py-[7px] text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    ใช้ · Apply
                  </button>
                </div>
              </div>
            </>
          )}
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
