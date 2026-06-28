import { Card } from "@/components/ui/Card";
import { fmtMoney } from "@/lib/format";

const AXIS = ["29 พ.ค.", "5 มิ.ย.", "12 มิ.ย.", "19 มิ.ย.", "27 มิ.ย."];

/** Daily-spend bars: accent fill, last/peak day highlighted, average label. */
export function DailySpendCard({ daily }: { daily: number[] }) {
  const max = Math.max(...daily);
  const avg = Math.round(daily.reduce((s, v) => s + v, 0) / daily.length);

  return (
    <Card className="px-5 py-[18px]">
      <div className="mb-[18px] flex items-baseline justify-between">
        <div>
          <div className="text-section-title">รายจ่ายรายวัน · Daily spend</div>
          <div className="text-[12px] text-muted">30 วันล่าสุด · all accounts combined</div>
        </div>
        <div className="num text-[13px] text-ink">
          <span className="text-accent">●</span> Spend{" "}
          <span className="font-medium text-muted-2">avg {fmtMoney(avg)}/d</span>
        </div>
      </div>

      <div className="flex h-[188px] items-end gap-[3px]">
        {daily.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[3px] bg-accent"
              style={{ height: `${20 + (v / max) * 80}%`, opacity: v >= max * 0.93 ? 1 : 0.82 }}
            />
          </div>
        ))}
      </div>

      <div className="num mt-[9px] flex justify-between text-[10.5px] text-faint">
        {AXIS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </Card>
  );
}
