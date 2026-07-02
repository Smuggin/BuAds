"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { fmtMoney } from "@/lib/format";
import type { OverviewDailyAccount } from "@/data/types";

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2026-06-05" → "5 มิ.ย." (best-effort; falls back to the raw string). */
function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1] ?? ""}`.trim();
}

/** Up to `count` evenly-spaced axis labels derived from the series. `fmt` turns a
 *  raw label (ISO date, or "HH:00" when hourly) into its display form. */
function axisLabels(dates: string[], fmt: (s: string) => string, count = 5): string[] {
  if (dates.length <= count) return dates.map(fmt);
  const step = (dates.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => fmt(dates[Math.round(i * step)]));
}

type Mode = "spend" | "revenue";

/** Daily bars, stacked by ad account, with a Spend/Revenue toggle. Each day is a
 *  full-height column split into per-account segments (colored by account); the
 *  tallest day drives the scale. Hover lists each account's amount + the day total.
 *  `series` + `dates` come from /api/overview (dailyByAccount / dailyDates). */
export function DailySpendCard({
  series = [],
  dates = [],
  granularity = "day",
}: {
  series?: OverviewDailyAccount[];
  dates?: string[];
  granularity?: "day" | "hour";
}) {
  const [mode, setMode] = useState<Mode>("spend");
  const pick = (a: OverviewDailyAccount) => (mode === "spend" ? a.spend : a.revenue);
  const hourly = granularity === "hour";
  // Hourly labels arrive pre-formatted ("HH:00"); daily ones are ISO dates.
  const fmtLabel = (s: string) => (hourly ? s : fmtDay(s));

  // Per-bucket totals across accounts (aligned to `dates`).
  const totals = dates.map((_, i) => series.reduce((s, a) => s + (pick(a)[i] ?? 0), 0));
  const max = totals.length ? Math.max(...totals, 1) : 1;
  const nonZeroBuckets = totals.filter((v) => v > 0).length;
  const avg = nonZeroBuckets ? Math.round(totals.reduce((s, v) => s + v, 0) / nonZeroBuckets) : 0;
  const axis = axisLabels(dates, fmtLabel);
  const hasData = dates.length > 0 && totals.some((v) => v > 0);
  const multiAccount = series.length > 1;

  return (
    <Card className="flex flex-col px-5 py-[18px]">
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <div>
          <div className="text-section-title">
            {mode === "spend"
              ? hourly ? "รายจ่ายรายชั่วโมง · Hourly spend" : "รายจ่ายรายวัน · Daily spend"
              : hourly ? "รายได้รายชั่วโมง · Hourly revenue" : "รายได้รายวัน · Daily revenue"}
          </div>
          <div className="text-[12px] text-muted">
            {dates.length
              ? `${hourly ? "วันนี้ · today" : `${dates.length} วันล่าสุด`} · ${multiAccount ? `${series.length} accounts stacked` : "1 account"}`
              : "all accounts combined"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="num whitespace-nowrap text-[13px] text-muted-2">
            avg {fmtMoney(avg)}/{hourly ? "hr" : "d"}
          </div>
          {/* Spend / Revenue mode toggle */}
          <div className="flex rounded-control border border-border bg-field-bg p-[2px] text-[11.5px] font-semibold">
            {(["spend", "revenue"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-[6px] px-[10px] py-[3px] transition-colors duration-bg ${
                  mode === m ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                {m === "spend" ? "Spend" : "Revenue"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasData ? (
        <div className="flex flex-1 flex-col">
          <div className="flex min-h-[188px] flex-1 items-end gap-[3px]">
            {dates.map((_, di) => {
              const total = totals[di];
              const isPeak = total >= max * 0.93;
              return (
                <div key={di} className="group flex h-full flex-1 items-end">
                  {/* the bar wrapper — height scales to the day total; NOT clipped, so
                      the tooltip (anchored to the bar top) can overflow above it. The
                      inner layer clips the stacked segments to rounded corners. */}
                  <div
                    className="relative w-full rounded-t-[3px]"
                    style={{ height: `${total ? 20 + (total / max) * 80 : 0}%` }}
                  >
                    <div className="absolute inset-0 flex flex-col-reverse overflow-hidden rounded-t-[3px]">
                      {series.map((a, ai) => {
                        const v = pick(a)[di] ?? 0;
                        if (v <= 0) return null;
                        return (
                          <div
                            key={ai}
                            style={{
                              height: `${(v / total) * 100}%`,
                              background: a.color,
                              opacity: isPeak ? 1 : 0.82,
                            }}
                          />
                        );
                      })}
                    </div>
                    {/* hover tooltip: per-account amounts + total for the day */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden min-w-[132px] -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-ink px-[9px] py-[7px] text-[10.5px] text-white shadow-dropdown group-hover:block">
                      <div className="mb-[5px] flex items-center justify-between gap-3 border-b border-white/15 pb-[4px] font-semibold">
                        <span>{dates[di] ? fmtLabel(dates[di]) : ""}</span>
                        <span className="num">{fmtMoney(total)}</span>
                      </div>
                      {series.map((a, ai) => {
                        const v = pick(a)[di] ?? 0;
                        if (v <= 0) return null;
                        return (
                          <div key={ai} className="flex items-center justify-between gap-3 py-[1px]">
                            <span className="flex items-center gap-[5px]">
                              <span
                                className="inline-block h-[7px] w-[7px] flex-shrink-0 rounded-[2px]"
                                style={{ background: a.color }}
                              />
                              <span className="text-white/85">{a.name}</span>
                            </span>
                            <span className="num text-white/95">{fmtMoney(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="num mt-[9px] flex justify-between text-[10.5px] text-faint">
            {axis.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[188px] flex-1 items-center justify-center text-[12.5px] text-muted">
          {mode === "spend"
            ? "ยังไม่มีข้อมูลรายวัน · ซิงค์เพื่อโหลด · No daily data yet — run a sync"
            : "ยังไม่มีข้อมูลรายได้รายวัน · No daily revenue yet — run a sync"}
        </div>
      )}
    </Card>
  );
}
