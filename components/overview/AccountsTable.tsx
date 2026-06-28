"use client";

import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { RAMP } from "@/lib/constants";
import { usePerfColor } from "@/store/AppProvider";
import type { OverviewAccountRow } from "@/data/types";

const HEAD = "px-[14px] py-[10px] text-right font-semibold";

/** Consolidated ad-accounts table — perf-colored ROAS, status chips, connect CTA. */
export function AccountsTable({ accounts }: { accounts: OverviewAccountRow[] }) {
  const pc = usePerfColor();
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
              <th className="px-5 py-[10px] text-left font-semibold">บัญชี · Account</th>
              <th className={HEAD}>Spend</th>
              <th className={HEAD}>Revenue</th>
              <th className={HEAD}>ROAS</th>
              <th className={HEAD}>Purch.</th>
              <th className={HEAD}>CPA</th>
              <th className={HEAD}>CTR</th>
              <th className="px-5 py-[10px] text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => {
              const active = a.status === "Active";
              return (
                <tr key={a.name} className="border-t border-border-2">
                  <td className="px-5 py-[13px]">
                    <div className="flex items-center gap-[11px]">
                      <div
                        className="num flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-control text-[12px] font-semibold text-white"
                        style={{ background: RAMP[i] }}
                      >
                        {a.initials}
                      </div>
                      <div className="leading-[1.25]">
                        <div className="font-semibold text-ink">{a.name}</div>
                        <div className="text-[11px] text-muted-2">{a.platform}</div>
                      </div>
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
