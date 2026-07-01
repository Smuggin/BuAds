import { Card } from "@/components/ui/Card";
import { RAMP } from "@/lib/constants";
import type { OverviewAccountRow } from "@/data/types";

const MAX_ROWS = 6; // keep the list ~as tall as the Daily-spend card; rest collapse to "+N"
const rampColor = (i: number) => RAMP[i % RAMP.length];

/** Spend-share stacked bar + legend. Only accounts that actually spent are shown,
 *  ranked by contribution; the long tail collapses into a faint "+ N เพิ่มเติม". */
export function SpendShareCard({ accounts }: { accounts: OverviewAccountRow[] }) {
  const contributing = accounts
    .filter((a) => a.rawSpend > 0)
    .sort((a, b) => b.rawSpend - a.rawSpend);
  const total = contributing.reduce((s, a) => s + a.rawSpend, 0) || 1;

  const shown = contributing.slice(0, MAX_ROWS);
  const hidden = contributing.slice(MAX_ROWS);
  const hiddenSpend = hidden.reduce((s, a) => s + a.rawSpend, 0);
  const pct = (v: number) => ((v / total) * 100).toFixed(1);

  return (
    <Card className="flex flex-col px-5 py-[18px]">
      <div className="text-section-title">งบตามบัญชี · Spend share</div>
      <div className="mb-4 text-[12px] text-muted">
        สัดส่วนงบ {contributing.length} บัญชี
      </div>

      {/* stacked bar: shown segments + one faint segment for the collapsed tail */}
      <div className="mb-[18px] flex h-[13px] gap-[2px] overflow-hidden rounded-[7px]">
        {shown.map((a, i) => (
          <div key={a.name} style={{ width: `${(a.rawSpend / total) * 100}%`, background: rampColor(i) }} />
        ))}
        {hiddenSpend > 0 && (
          <div style={{ width: `${(hiddenSpend / total) * 100}%`, background: "#e4e7ec" }} />
        )}
        {contributing.length === 0 && <div className="w-full bg-[#eef0f3]" />}
      </div>

      <div className="flex flex-col gap-[11px]">
        {shown.map((a, i) => (
          <div key={a.name} className="flex items-center gap-[9px]">
            <span
              className="h-[10px] w-[10px] flex-shrink-0 rounded-[3px]"
              style={{ background: rampColor(i) }}
            />
            <span className="flex-1 truncate text-[12.5px] text-ink-2">{a.name}</span>
            <span className="num text-[12px] text-ink">{a.spend}</span>
            <span className="num w-[42px] text-right text-[11px] text-faint">{pct(a.rawSpend)}%</span>
          </div>
        ))}

        {hidden.length > 0 && (
          <div className="flex items-center gap-[9px] pt-[1px]">
            <span className="h-[10px] w-[10px] flex-shrink-0 rounded-[3px] bg-[#e4e7ec]" />
            <span className="flex-1 text-[12px] font-medium text-faint">
              + {hidden.length} เพิ่มเติม · more
            </span>
            <span className="num w-[42px] text-right text-[11px] text-faint">{pct(hiddenSpend)}%</span>
          </div>
        )}

        {contributing.length === 0 && (
          <div className="py-2 text-[12.5px] text-muted">ยังไม่มีการใช้จ่าย · No spend yet</div>
        )}
      </div>
    </Card>
  );
}
