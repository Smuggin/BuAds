"use client";

import { useState } from "react";
import { FORMAT_META, METRIC_DEFS } from "@/lib/constants";
import { dirSymbol, fmtMetric, fmtMoney } from "@/lib/format";
import { usePerfColor } from "@/store/AppProvider";
import { aggregateProfile, evalCampaign, rankCreatives, type CampaignState, type CreativeVerdict } from "@/lib/kpi";
import { accountMetaFor } from "@/lib/constants";
import { CREATIVE_PROFILES } from "@/data/profiles";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { AudienceBreakdown } from "@/components/charts/AudienceBreakdown";
import { CreativePlayer } from "@/components/creatives/CreativePlayer";
import type {
  Campaign,
  Creative,
  MetricKey,
  Product,
  ScaleThresholds,
  Thresholds,
} from "@/data/types";

const VERDICT_META: Record<CreativeVerdict, { label: string; color: string }> = {
  marked: { label: "ดีเด่น · พร้อม Scale", color: "#1f8a5b" },
  ok: { label: "ผ่านเกณฑ์", color: "#2f6fd0" },
  poor: { label: "ต่ำกว่าเกณฑ์", color: "#d6453d" },
};

interface Props {
  campaign: Campaign;
  product: Product;
  thresholds: Thresholds;
  scaleThresholds: ScaleThresholds;
  skip: MetricKey[];
  state: CampaignState;
  creatives: Creative[];
  creativeOpen: Record<string, boolean>;
  onToggleCreative: (id: string, defaultOn: boolean) => void;
  onClose: () => void;
  onBudget: () => void;
}

export function CampaignDetail({
  campaign,
  product,
  thresholds,
  scaleThresholds,
  skip,
  state,
  creatives,
  creativeOpen,
  onToggleCreative,
  onClose,
  onBudget,
}: Props) {
  const pc = usePerfColor();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const acc = accountMetaFor(campaign.account);
  const ev = evalCampaign(campaign.metrics, thresholds, skip, scaleThresholds);
  const campCreatives = creatives.filter((c) => c.campaigns.includes(campaign.id));
  const { ranked, openCount } = rankCreatives(campCreatives, thresholds, creativeOpen);
  const profile = aggregateProfile(
    campCreatives.length ? campCreatives : [{ profileKey: "B", spend: 1 }],
    CREATIVE_PROFILES,
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-[7px] self-start rounded-control border border-[#dde1e7] bg-card px-[14px] py-2 text-[12.5px] font-semibold text-ink hover:bg-[#f3f4f6]"
      >
        ← กลับไปรายการแคมเปญ
      </button>

      {/* header + metric breakdown */}
      <Card className="p-5">
        <div className="mb-[18px] flex flex-wrap items-start gap-[14px]">
          <div
            className="num flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-thumb text-[13px] font-semibold text-white"
            style={{ background: acc.color }}
          >
            {campaign.sku.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[19px] font-semibold tracking-[-0.01em]">{campaign.name}</div>
            <div className="mt-[3px] text-[12.5px] text-muted">
              {product.th} · {campaign.sku} · {acc.th} ({acc.en})
            </div>
          </div>
          <div className="flex items-center gap-[10px]">
            <span
              className="rounded-pill px-[10px] py-1 text-[11.5px] font-medium"
              style={{ background: state.statusColor + "18", color: state.statusColor }}
            >
              {state.statusIcon} {state.statusLabel}
            </span>
            <button
              type="button"
              onClick={onBudget}
              className="num inline-flex items-center gap-[6px] rounded-control border border-[#dde1e7] bg-card px-[13px] py-2 text-[12px] font-semibold text-ink"
            >
              งบ {fmtMoney(campaign.budget)}/วัน · ปรับ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2 sm:grid-cols-3 lg:grid-cols-6">
          {METRIC_DEFS.map((m, i) => {
            const cell = ev.cells[i];
            const scaleTarget = scaleThresholds[m.key];
            const atScale = cell.tier === "scale";
            return (
              <div
                key={m.key}
                className="bg-card px-3 py-[11px]"
                title={cell.enforced ? undefined : "ข้ามเกณฑ์นี้ · skipped (not judged)"}
                style={{ opacity: cell.enforced ? 1 : 0.45, background: atScale ? "rgba(31,138,91,.06)" : undefined }}
              >
                <div className="text-[10px] uppercase tracking-[0.03em] text-muted-2">{m.short}</div>
                <div
                  className="num text-[17px] font-semibold"
                  style={{
                    color: !cell.enforced ? "#6b7280" : cell.ok ? "#1f8a5b" : "#d6453d",
                  }}
                >
                  {cell.disp}
                  {atScale && <span className="ml-1 text-[12px]" title="ถึงเป้าสเกล · at scale target">⤴</span>}
                </div>
                <div className="num text-[10px] text-[#b7bcc4]">
                  {dirSymbol(m.dir)}
                  {fmtMetric(m.key, thresholds[m.key])}
                  {cell.enforced && scaleTarget != null && (
                    <span className="text-success/80"> · ⤴{fmtMetric(m.key, scaleTarget)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* creatives ranked */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-2 px-[18px] py-[15px]">
          <div>
            <div className="text-section-title">ครีเอทีฟในแคมเปญนี้ · Creatives</div>
            <div className="text-[11.5px] text-muted-2">เรียงตามผลงานดีสุด — เปิด/ปิดแต่ละตัวได้ตามผลงาน</div>
          </div>
          <span className="num text-[11.5px] text-muted">
            เปิดอยู่ {openCount}/{ranked.length}
          </span>
        </div>
        {ranked.map((r, i) => {
          const fm = FORMAT_META[r.creative.format];
          const vm = VERDICT_META[r.verdict];
          const expanded = expandedId === r.creative.id;
          return (
            <div key={r.creative.id} className="border-t border-border-3">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : r.creative.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(expanded ? null : r.creative.id);
                  }
                }}
                className="flex cursor-pointer items-center gap-[13px] px-4 py-[13px] transition-opacity duration-opacity hover:bg-field-bg"
                style={{ background: r.on ? undefined : "#fbfbfc", opacity: r.on ? 1 : 0.62 }}
              >
                <span
                  className="num w-[26px] flex-shrink-0 text-[12px] font-bold"
                  style={{ color: i === 0 ? "#1f8a5b" : "#aeb3bb" }}
                >
                  #{r.rank}
                </span>
                <div
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-control text-[16px] text-white"
                  style={{ background: fm.color }}
                >
                  {fm.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-[9px]">
                    <span className="text-[13.5px] font-semibold text-ink">{r.creative.name}</span>
                    <span
                      className="whitespace-nowrap rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold"
                      style={{ background: vm.color + "18", color: vm.color }}
                    >
                      {vm.label}
                    </span>
                  </div>
                  <div className="num mt-[5px] flex flex-wrap items-center gap-[14px] text-[11.5px] text-muted">
                    <span style={{ color: pc(r.creative.roas) }}>
                      ROAS {Math.round(r.creative.roas * 10) / 10}
                    </span>
                    <span>CTR {Math.round(r.creative.ctr * 10) / 10}%</span>
                    <span>CPA {fmtMoney(r.creative.cpa)}</span>
                    <span>Spend {fmtMoney(r.creative.spend)}</span>
                    <span>Purch {r.creative.purchases}</span>
                  </div>
                </div>
                <span
                  className="flex-shrink-0 text-[11px] text-muted-2 transition-transform"
                  style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                  aria-hidden="true"
                >
                  ▾
                </span>
                {/* the on/off toggle must not trigger the row's expand */}
                <span onClick={(e) => e.stopPropagation()}>
                  <Toggle
                    on={r.on}
                    size="lg"
                    onClick={() => onToggleCreative(r.creative.id, r.defaultOn)}
                    label={`เปิด/ปิด ${r.creative.name}`}
                  />
                </span>
              </div>

              {expanded && (
                <div className="border-t border-border-3 bg-[#fafbfc] px-4 py-[18px]">
                  <div className="flex flex-wrap items-start gap-4">
                    <CreativePlayer
                      preview={r.creative.previewImageUrl ?? r.creative.thumbnailUrl}
                      name={r.creative.name}
                      format={r.creative.format}
                      videoId={r.creative.videoId}
                      permalinkUrl={r.creative.permalinkUrl}
                      fallback={{ icon: fm.icon, color: fm.color }}
                    />
                    <div className="min-w-[200px] flex-1">
                      {r.creative.caption && (
                        <p className="line-clamp-3 text-[12.5px] leading-[1.5] text-ink-2">
                          {r.creative.caption}
                        </p>
                      )}
                      {r.creative.permalinkUrl && (
                        <a
                          href={r.creative.permalinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 inline-block text-[12px] font-medium text-accent hover:underline"
                        >
                          เปิดโพสต์ต้นฉบับ · Open original →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-[18px]">
                    <div className="mb-[14px] text-[12px] font-semibold text-slate">
                      ผู้ชมของครีเอทีฟนี้ · This creative’s audience
                    </div>
                    <AudienceBreakdown
                      profile={r.creative.audience ?? CREATIVE_PROFILES[r.creative.profileKey]}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* audience */}
      <Card className="px-5 py-[18px]">
        <div className="text-section-title">ใครเห็นแคมเปญนี้ · Audience breakdown</div>
        <div className="mb-[18px] text-[11.5px] text-muted-2">
          รวมทุกครีเอทีฟในแคมเปญ — อายุ เพศ จังหวัด และวัน×เวลา
        </div>
        <AudienceBreakdown profile={profile} />
      </Card>
    </div>
  );
}
