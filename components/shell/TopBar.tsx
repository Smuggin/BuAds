"use client";

import { usePathname } from "next/navigation";
import { RANGES, TITLES } from "@/lib/constants";
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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#e4e7ec] bg-page-bg/[0.86] px-[26px] py-[14px] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-[14px]">
        <div>
          <div className="text-page-title">{title}</div>
          <div className="text-[12px] text-muted">{sub}</div>
        </div>
      </div>

      <div className="flex items-center gap-[10px]">
        {/* account selector (display-only for now) */}
        <button
          type="button"
          className="flex items-center gap-[9px] rounded-control border border-[#dde1e7] bg-card px-[13px] py-2 text-[12.5px] font-medium text-ink"
        >
          <span className="h-[7px] w-[7px] rounded-full bg-success" />
          ทุกบัญชี · All accounts (6)
          <span className="text-[10px] text-muted-2">▾</span>
        </button>

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
