import { Card } from "@/components/ui/Card";
import { RAMP } from "@/lib/constants";
import type { OverviewAccountRow } from "@/data/types";

/** Spend-share stacked bar + legend (6 accounts, ramp colors, % split). */
export function SpendShareCard({ accounts }: { accounts: OverviewAccountRow[] }) {
  const total = accounts.reduce((s, a) => s + a.rawSpend, 0);

  return (
    <Card className="flex flex-col px-5 py-[18px]">
      <div className="text-section-title">งบตามบัญชี · Spend share</div>
      <div className="mb-4 text-[12px] text-muted">สัดส่วนงบ 6 บัญชี</div>

      <div className="mb-[18px] flex h-[13px] gap-[2px] overflow-hidden rounded-[7px]">
        {accounts.map((a, i) => (
          <div
            key={a.name}
            style={{ width: `${(a.rawSpend / total) * 100}%`, background: RAMP[i] }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-[11px]">
        {accounts.map((a, i) => (
          <div key={a.name} className="flex items-center gap-[9px]">
            <span
              className="h-[10px] w-[10px] flex-shrink-0 rounded-[3px]"
              style={{ background: RAMP[i] }}
            />
            <span className="flex-1 text-[12.5px] text-ink-2">{a.name}</span>
            <span className="num text-[12px] text-ink">{a.spend}</span>
            <span className="w-[38px] text-right text-[11px] text-faint">
              {((a.rawSpend / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
