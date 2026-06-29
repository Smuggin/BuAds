"use client";

import { FORMAT_META, METRIC_DEFS } from "@/lib/constants";
import { dirSymbol, fmtK, fmtMetric, fmtMoney } from "@/lib/format";
import { usePerfColor } from "@/store/AppProvider";
import { aggregateProfile, evalCampaign, rankCreatives, type CampaignState, type CreativeVerdict } from "@/lib/kpi";
import { accountMetaFor } from "@/lib/constants";
import { CREATIVE_PROFILES } from "@/data/profiles";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { AudienceBreakdown } from "@/components/charts/AudienceBreakdown";
import type { Campaign, Creative, Product, Thresholds } from "@/data/types";

const VERDICT_META: Record<CreativeVerdict, { label: string; color: string }> = {
  marked: { label: "ดีเด่น · พร้อม Scale", color: "#1f8a5b" },
  ok: { label: "ผ่านเกณฑ์", color: "#2f6fd0" },
  poor: { label: "ต่ำกว่าเกณฑ์", color: "#d6453d" },
};

interface Props {
  campaign: Campaign;
  product: Product;
  thresholds: Thresholds;
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
  state,
  creatives,
  creativeOpen,
  onToggleCreative,
  onClose,
  onBudget,
}: Props) {
  const pc = usePerfColor();
  const acc = accountMetaFor(campaign.account);
  const ev = evalCampaign(campaign.metrics, thresholds);
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

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2 sm:grid-cols-4 lg:grid-cols-7">
          {METRIC_DEFS.map((m, i) => {
            const cell = ev.cells[i];
            return (
              <div key={m.key} className="bg-card px-3 py-[11px]">
                <div className="text-[10px] uppercase tracking-[0.03em] text-muted-2">{m.short}</div>
                <div
                  className="num text-[17px] font-semibold"
                  style={{ color: cell.ok ? "#1f8a5b" : "#d6453d" }}
                >
                  {cell.disp}
                </div>
                <div className="num text-[10px] text-[#b7bcc4]">
                  {dirSymbol(m.dir)}
                  {fmtMetric(m.key, thresholds[m.key])}
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
          return (
            <div
              key={r.creative.id}
              className="flex items-center gap-[13px] border-t border-border-3 px-4 py-[13px] transition-opacity duration-opacity"
              style={{ background: r.on ? "#fff" : "#fbfbfc", opacity: r.on ? 1 : 0.62 }}
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
              <Toggle
                on={r.on}
                size="lg"
                onClick={() => onToggleCreative(r.creative.id, r.defaultOn)}
                label={`เปิด/ปิด ${r.creative.name}`}
              />
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
