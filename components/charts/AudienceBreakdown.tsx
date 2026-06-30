/**
 * Audience breakdown viz from an AudienceProfile: age bars, gender segments,
 * province bars, day×time heatmap. Reused by campaign/creative detail (Phase 4-5).
 * Accent threads through via the --accent CSS var so it stays re-themeable.
 */
import {
  AGE_LABELS,
  DAY_LABELS,
  GENDER_COLORS,
  GENDER_LABELS,
  PROVINCE_LABELS,
} from "@/data/profiles";
import type { AudienceProfile } from "@/data/types";

export function AudienceBreakdown({ profile }: { profile: AudienceProfile }) {
  // Real synced profiles bring their own region labels (top regions vary); the
  // mock profile omits them and we fall back to the fixed province list.
  const provinceLabels = profile.provinceLabels ?? PROVINCE_LABELS;
  // Guard the bar denominators: a real profile may have a missing/zero dimension.
  const ageMax = Math.max(1, ...profile.age);
  const provMax = Math.max(1, ...profile.province);
  const hours = profile.hour.length || 12;

  // heatmap intensity = day[d] * hour[h]
  const heat: number[][] = [];
  let heatMax = 0;
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    for (let h = 0; h < hours; h++) {
      const v = (profile.day[d] ?? 0) * (profile.hour[h] ?? 0);
      row.push(v);
      if (v > heatMax) heatMax = v;
    }
    heat.push(row);
  }
  const heatDiv = heatMax || 1;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1.15fr_1fr]">
        {/* Age */}
        <div>
          <SubLabel>ช่วงอายุ · Age</SubLabel>
          <div className="flex h-[120px] items-end gap-3">
            {profile.age.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
                <div className="num text-[10.5px] font-semibold text-ink">{Math.round(v)}%</div>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-accent"
                    style={{ height: `${(v / ageMax) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-2">{AGE_LABELS[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div>
          <SubLabel>เพศ · Gender</SubLabel>
          <div className="flex flex-col gap-[13px]">
            {profile.gender.map((v, i) => (
              <div key={i}>
                <div className="mb-[6px] flex items-center gap-2">
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]"
                    style={{ background: GENDER_COLORS[i] }}
                  />
                  <span className="flex-1 text-[12px] text-ink-2">{GENDER_LABELS[i]}</span>
                  <span className="num text-[12px] font-semibold">{Math.round(v)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-[5px] bg-[#f0f1f3]">
                  <div className="h-full rounded-[5px]" style={{ width: `${v}%`, background: GENDER_COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1.3fr]">
        {/* Provinces */}
        <div>
          <SubLabel>จังหวัด · Top provinces</SubLabel>
          <div className="flex flex-col gap-[10px]">
            {profile.province.map((v, i) => (
              <div key={i} className="flex items-center gap-[10px]">
                <span className="w-[118px] flex-shrink-0 text-[11.5px] text-ink-2">
                  {provinceLabels[i]}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className="h-2 min-w-[4px] rounded-[5px] bg-accent"
                    style={{ width: `${(v / provMax) * 100}%` }}
                  />
                  <span className="num text-[11px] font-semibold text-ink">{Math.round(v)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Day × time heatmap */}
        <div>
          <SubLabel>วัน × เวลา · Day × time</SubLabel>
          <div className="flex flex-col gap-1">
            {heat.map((row, i) => (
              <div key={i} className="flex items-center gap-[6px]">
                <span className="w-[18px] text-center text-[10.5px] text-muted">
                  {DAY_LABELS[i]}
                </span>
                <div className="flex flex-1 gap-1">
                  {row.map((v, j) => (
                    <div
                      key={j}
                      className="h-5 flex-1 rounded-[3px]"
                      style={{ background: `rgb(var(--accent-rgb) / ${(0.05 + (v / heatDiv) * 0.92).toFixed(3)})` }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-[2px] flex items-center gap-[6px] text-[9.5px] text-faint">
              <span className="w-[18px]" />
              <span>น้อย</span>
              <div className="flex flex-1 justify-end">
                <span>มาก</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-[14px] text-[12px] font-semibold text-slate">{children}</div>;
}
