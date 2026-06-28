"use client";

import { useEffect, useState } from "react";
import { getOverview, type OverviewData } from "@/lib/api";
import { usePerfColor } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";

export function BreakdownView() {
  const [bd, setBd] = useState<OverviewData["breakdown"] | null>(null);
  const pc = usePerfColor();

  useEffect(() => {
    let alive = true;
    getOverview().then((d) => alive && setBd(d.breakdown));
    return () => {
      alive = false;
    };
  }, []);

  if (!bd) {
    return (
      <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
      </div>
    );
  }

  const ageMax = Math.max(...bd.age.map((a) => a[1]));
  const provMax = Math.max(...bd.province.map((p) => p[1]));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Age */}
      <Card className="px-5 py-[18px]">
        <Title>ช่วงอายุ · Age</Title>
        <div className="flex h-[150px] items-end gap-3">
          {bd.age.map(([label, pct, roas]) => (
            <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
              <div className="num text-[10.5px] font-semibold" style={{ color: pc(roas) }}>
                {roas.toFixed(1)}x
              </div>
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t-[4px] bg-accent" style={{ height: `${(pct / ageMax) * 100}%` }} />
              </div>
              <div className="num text-[10.5px] text-ink">{pct}%</div>
              <div className="text-[10px] text-muted-2">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Gender */}
      <Card className="px-5 py-[18px]">
        <Title>เพศ · Gender</Title>
        <div className="flex flex-col gap-[15px]">
          {bd.gender.map(([label, pct, roas, color]) => (
            <div key={label}>
              <div className="mb-[6px] flex items-center gap-2">
                <span className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]" style={{ background: color }} />
                <span className="flex-1 text-[12px] text-ink-2">{label}</span>
                <span className="num text-[11px]" style={{ color: pc(roas) }}>{roas.toFixed(1)}x</span>
                <span className="num w-[42px] text-right text-[12px] font-semibold">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-[5px] bg-[#f0f1f3]">
                <div className="h-full rounded-[5px]" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Provinces */}
      <Card className="px-5 py-[18px]">
        <Title>จังหวัด · Top provinces</Title>
        <div className="flex flex-col gap-[11px]">
          {bd.province.map(([label, pct, roas]) => (
            <div key={label} className="flex items-center gap-[10px]">
              <span className="w-[150px] flex-shrink-0 text-[11.5px] text-ink-2">{label}</span>
              <div className="flex flex-1 items-center gap-[10px]">
                <div className="h-2 min-w-[4px] flex-1">
                  <div className="h-full rounded-[5px] bg-accent" style={{ width: `${(pct / provMax) * 100}%` }} />
                </div>
                <span className="num w-[34px] text-right text-[11px] font-semibold text-ink">{pct}%</span>
                <span className="num w-[42px] text-right text-[11px]" style={{ color: pc(roas) }}>
                  {roas.toFixed(1)}x
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Heatmap */}
      <Card className="px-5 py-[18px]">
        <Title>วัน × เวลา · Day × time</Title>
        <div className="flex flex-col gap-[5px]">
          {bd.heat.grid.map((row, i) => (
            <div key={i} className="flex items-center gap-[6px]">
              <span className="w-[18px] text-center text-[10.5px] text-muted">{bd.heat.days[i]}</span>
              <div className="flex flex-1 gap-1">
                {row.map((v, j) => (
                  <div
                    key={j}
                    className="h-[22px] flex-1 rounded-[3px]"
                    style={{ background: `rgb(var(--accent-rgb) / ${(0.05 + (v / 100) * 0.92).toFixed(3)})` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-[6px] text-[9.5px] text-faint">
            <span className="w-[18px]" />
            <div className="num flex flex-1 justify-between">
              <span>0</span><span>6</span><span>12</span><span>18</span><span>22</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-faint">
            <span>น้อย</span><span>มาก</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="mb-[16px] text-section-title">{children}</div>;
}
