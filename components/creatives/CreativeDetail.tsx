"use client";

import { accountMetaFor, FORMAT_META } from "@/lib/constants";
import { fmtK, fmtMoney, round1 } from "@/lib/format";
import { evalCampaign, resolveCampaignState } from "@/lib/kpi";
import { effAutoClose, effThresholds } from "@/lib/resolvers";
import { usePerfColor } from "@/store/AppProvider";
import { CREATIVE_PROFILES } from "@/data/profiles";
import { Card } from "@/components/ui/Card";
import { AudienceBreakdown } from "@/components/charts/AudienceBreakdown";
import type { Campaign, Creative, Product, Thresholds } from "@/data/types";

interface Props {
  creative: Creative;
  products: Product[];
  campaigns: Campaign[];
  prodThr: Record<string, Partial<Thresholds>>;
  autoOverride: Record<string, boolean>;
}

export function CreativeDetail({ creative, products, campaigns, prodThr, autoOverride }: Props) {
  const pc = usePerfColor();
  const fm = FORMAT_META[creative.format];
  const product = products.find((p) => p.sku === creative.sku)!;

  const tiles = [
    { l: "Spend", v: fmtMoney(creative.spend) },
    { l: "ROAS", v: round1(creative.roas) + "x", color: pc(creative.roas) },
    { l: "CTR", v: round1(creative.ctr) + "%" },
    { l: "Purchases", v: String(creative.purchases) },
    { l: "CPA", v: fmtMoney(creative.cpa) },
    { l: "Impr.", v: fmtK(creative.impressions) },
    { l: "Freq.", v: String(round1(creative.frequency)) },
  ];

  const campRows = creative.campaigns.map((cid) => {
    const c = campaigns.find((x) => x.id === cid)!;
    const p = products.find((x) => x.sku === c.sku)!;
    const thr = effThresholds(p, prodThr);
    const ev = evalCampaign(c.metrics, thr);
    const st = resolveCampaignState(ev.verdict, effAutoClose(p, autoOverride), undefined);
    return { c, acc: accountMetaFor(c.account).th, st };
  });

  return (
    <Card className="flex flex-col gap-5 p-5">
      {/* head */}
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="flex h-[92px] w-[92px] flex-shrink-0 items-center justify-center rounded-[14px] text-[34px] text-white"
          style={{ background: fm.color }}
        >
          {fm.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[9px]">
            <span className="text-[19px] font-semibold tracking-[-0.01em]">{creative.name}</span>
            <span
              className="rounded-[6px] px-[10px] py-[3px] text-[11px] font-semibold"
              style={{ background: fm.color + "18", color: fm.color }}
            >
              {creative.format}
            </span>
          </div>
          <div className="mt-1 text-[12.5px] text-muted">
            {product.th} · {creative.sku} · ใช้ใน {creative.campaigns.length} แคมเปญ
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => (
          <div key={t.l} className="bg-card px-3 py-[11px]">
            <div className="text-[10px] uppercase tracking-[0.03em] text-muted-2">{t.l}</div>
            <div
              className="num text-[19px] font-semibold tracking-[-0.02em]"
              style={{ color: t.color ?? "#16181d" }}
            >
              {t.v}
            </div>
          </div>
        ))}
      </div>

      {/* in campaigns */}
      <div>
        <div className="mb-3 text-[12px] font-semibold text-slate">
          อยู่ในแคมเปญ · In campaigns
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-border-2">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-field-bg text-[10.5px] uppercase tracking-[0.02em] text-muted">
                <th className="px-4 py-[9px] text-left font-semibold">แคมเปญ</th>
                <th className="px-3 py-[9px] text-right font-semibold">ROAS</th>
                <th className="px-3 py-[9px] text-right font-semibold">CTR</th>
                <th className="px-3 py-[9px] text-right font-semibold">CPA</th>
                <th className="px-3 py-[9px] text-right font-semibold">Cost/วัน</th>
                <th className="px-4 py-[9px] text-left font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {campRows.map(({ c, acc, st }) => (
                <tr key={c.id} className="border-t border-border-2">
                  <td className="px-4 py-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: st.on ? "#1f8a5b" : "#cdd1d8" }} />
                      <div>
                        <div className="font-semibold text-ink">{c.name}</div>
                        <div className="text-[10.5px] text-muted-2">{acc}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num px-3 py-[11px] text-right font-semibold" style={{ color: pc(c.metrics.roas) }}>
                    {round1(c.metrics.roas)}x
                  </td>
                  <td className="num px-3 py-[11px] text-right text-ink-2">{round1(c.metrics.ctr)}%</td>
                  <td className="num px-3 py-[11px] text-right text-ink-2">{fmtMoney(c.metrics.cpa)}</td>
                  <td className="num px-3 py-[11px] text-right text-ink-2">{fmtMoney(c.metrics.cost)}</td>
                  <td className="px-4 py-[11px]">
                    <span
                      className="whitespace-nowrap rounded-pill px-[9px] py-1 text-[11px] font-semibold"
                      style={{ background: st.statusColor + "18", color: st.statusColor }}
                    >
                      {st.statusIcon} {st.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* audience */}
      <div>
        <div className="mb-[14px] text-[12px] font-semibold text-slate">
          ใครเห็นครีเอทีฟนี้ · Audience breakdown
        </div>
        <AudienceBreakdown profile={CREATIVE_PROFILES[creative.profileKey]} />
      </div>
    </Card>
  );
}
