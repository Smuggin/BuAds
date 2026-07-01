/**
 * Shared footer for the day×time heatmaps: an hour-of-day axis aligned to the 12
 * two-hour buckets (00,04,…,20 under their columns) + an intensity legend.
 * Matches the heatmap grid layout (w-[18px] day label + gap-[6px] + flex-1 cells).
 */

// Full Thai day names, indexed Mon..Sun like DAY_LABELS.
const DAY_FULL = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Hover label for a heatmap cell: dayIdx (0=Mon) × 2-hour bucket j → "จันทร์ · 14:00–16:00". */
export function heatCellTitle(dayIdx: number, bucketIdx: number): string {
  const day = DAY_FULL[dayIdx] ?? "";
  return `${day} · ${hh(bucketIdx * 2)}–${hh(bucketIdx * 2 + 2)}`;
}

export function HeatFooter() {
  return (
    <div className="mt-[5px] flex flex-col gap-[5px]">
      {/* hour ticks — labelled every 4h, aligned under the buckets */}
      <div className="flex items-center gap-[6px]">
        <span className="w-[18px] flex-shrink-0" />
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 12 }, (_, j) => (
            <div
              key={j}
              className={`num min-w-0 flex-1 text-center text-[9px] leading-none ${
                j === 0 || j === 6 ? "font-semibold text-ink-2" : "text-muted-2"
              }`}
            >
              {j % 2 === 0 ? String(j * 2).padStart(2, "0") : ""}
            </div>
          ))}
        </div>
      </div>
      {/* caption + intensity gradient */}
      <div className="flex items-center gap-[6px] text-[9.5px] text-faint">
        <span className="w-[18px] flex-shrink-0" />
        <span className="flex-1">เวลา (น.) · hour of day</span>
        <span className="flex items-center gap-[5px]">
          น้อย
          <span
            className="h-[8px] w-[46px] rounded-[3px]"
            style={{
              background:
                "linear-gradient(to right, rgb(var(--accent-rgb) / 0.08), rgb(var(--accent-rgb) / 0.95))",
            }}
          />
          มาก
        </span>
      </div>
    </div>
  );
}
