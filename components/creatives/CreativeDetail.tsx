"use client";

import { accountMetaFor, FORMAT_META } from "@/lib/constants";
import { fmtK, fmtMoney, round1 } from "@/lib/format";
import { evalCampaign, resolveCampaignState } from "@/lib/kpi";
import { effCloseMode, effScaleThresholds, effSkipMetrics, effThresholds } from "@/lib/resolvers";
import { usePerfColor } from "@/store/AppProvider";
import { CREATIVE_PROFILES } from "@/data/profiles";
import { Card } from "@/components/ui/Card";
import { CreativePlayer } from "@/components/creatives/CreativePlayer";
import { AudienceBreakdown } from "@/components/charts/AudienceBreakdown";
import type {
  Campaign,
  CloseMode,
  Creative,
  MetricKey,
  Product,
  ScaleThresholds,
  Thresholds,
} from "@/data/types";

interface Props {
  creative: Creative;
  products: Product[];
  campaigns: Campaign[];
  prodThr: Record<string, Partial<Thresholds>>;
  prodScale: Record<string, ScaleThresholds>;
  closeOverride: Record<string, CloseMode>;
  skipOverride: Record<string, MetricKey[]>;
}

export function CreativeDetail({ creative, products, campaigns, prodThr, prodScale, closeOverride, skipOverride }: Props) {
  const pc = usePerfColor();
  const fm = FORMAT_META[creative.format];
  const product = products.find((p) => p.sku === creative.sku);
  const preview = creative.previewImageUrl ?? creative.thumbnailUrl;
  const vid = creative.video;
  const eng = creative.engagement;
  const hasVideo = !!vid && vid.plays3s > 0;
  const hasEng = !!eng && eng.reactions + eng.comments + eng.shares + eng.saves > 0;

  const tiles = [
    { l: "Spend", v: fmtMoney(creative.spend) },
    { l: "ROAS", v: round1(creative.roas) + "x", color: pc(creative.roas) },
    { l: "CTR", v: round1(creative.ctr) + "%" },
    { l: "Purchases", v: String(creative.purchases) },
    { l: "CPA", v: fmtMoney(creative.cpa) },
    { l: "Impr.", v: fmtK(creative.impressions) },
    { l: "Freq.", v: String(round1(creative.frequency)) },
  ];

  // Only render campaigns we can fully resolve: a creative may link to a campaign
  // that wasn't synced, or to one whose product is unmapped — guard the null-deref.
  const campRows = creative.campaigns
    .map((cid) => {
      const c = campaigns.find((x) => x.id === cid);
      const p = c ? products.find((x) => x.sku === c.sku) : undefined;
      return c && p ? { c, p } : null;
    })
    .filter((r): r is { c: Campaign; p: Product } => r !== null)
    .map(({ c, p }) => {
      const thr = effThresholds(p, prodThr);
      const ev = evalCampaign(
        c.metrics,
        thr,
        effSkipMetrics(p, skipOverride),
        effScaleThresholds(p, prodScale, prodThr),
      );
      const st = resolveCampaignState(ev.verdict, effCloseMode(p, closeOverride) !== "OFF", undefined, c.status === "ACTIVE");
      return { c, acc: accountMetaFor(c.account).th, st };
    });

  return (
    <Card className="flex flex-col gap-5 p-5">
      {/* head */}
      <div className="flex flex-wrap items-start gap-4">
        <CreativePlayer
          preview={preview}
          name={creative.name}
          format={creative.format}
          videoId={creative.videoId}
          permalinkUrl={creative.permalinkUrl}
          fallback={fm}
        />
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
            {product?.th ?? creative.sku} · {creative.sku} · ใช้ใน {campRows.length} แคมเปญ
            {creative.groupSize && creative.groupSize > 1
              ? ` · รวมจาก ${creative.groupSize} โฆษณา`
              : ""}
          </div>
          {creative.caption && (
            <div className="mt-[5px] line-clamp-2 max-w-[520px] text-[12px] text-ink-2">
              {creative.caption}
            </div>
          )}
          {creative.permalinkUrl && (
            <a
              href={creative.permalinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[6px] inline-block text-[12px] font-medium text-[#3b6fe0] hover:underline"
            >
              ดูโพสต์ · View post →
            </a>
          )}
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

      {/* creative breakdown — does it actually work? (video funnel + post engagement) */}
      {(hasVideo || hasEng) && (
        <div>
          <div className="mb-3 text-[12px] font-semibold text-slate">
            ครีเอทีฟทำงานไหม · Creative breakdown
          </div>
          <div className="flex flex-col gap-4 rounded-[10px] border border-border-2 p-4">
            {hasVideo && vid && (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border-2 bg-border-2 sm:grid-cols-4">
                  {[
                    { l: "Hook rate", s: "3 วิ · 3s", v: round1(vid.hookRate) + "%" },
                    { l: "Hold rate", s: "ดูจบ · ThruPlay", v: round1(vid.holdRate) + "%" },
                    { l: "Avg watch", s: "เฉลี่ย · avg", v: round1(vid.avgWatchSec) + "s" },
                    { l: "3s plays", s: "เริ่มดู · started", v: fmtK(vid.plays3s) },
                  ].map((t) => (
                    <div key={t.l} className="bg-card px-3 py-[10px]">
                      <div className="text-[10px] uppercase tracking-[0.03em] text-muted-2">{t.l}</div>
                      <div className="num text-[17px] font-semibold tracking-[-0.02em] text-ink">{t.v}</div>
                      <div className="text-[10px] text-faint">{t.s}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-[10px] text-[11px] font-semibold text-slate">
                    อัตราการดูต่อ · Retention (% of 3s plays)
                  </div>
                  <div className="flex flex-col gap-[9px]">
                    {[
                      { l: "25%", v: vid.p25 },
                      { l: "50%", v: vid.p50 },
                      { l: "75%", v: vid.p75 },
                      { l: "100%", v: vid.p100 },
                    ].map((r) => {
                      const pct = vid.plays3s ? (r.v / vid.plays3s) * 100 : 0;
                      return (
                        <div key={r.l} className="flex items-center gap-[10px]">
                          <span className="w-[44px] flex-shrink-0 text-[11.5px] text-ink-2">{r.l}</span>
                          <div className="flex flex-1 items-center gap-2">
                            <div
                              className="h-2 min-w-[4px] rounded-[5px] bg-accent"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                            <span className="num text-[11px] font-semibold text-ink">{Math.round(pct)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            {hasEng && eng && (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border-2 bg-border-2 sm:grid-cols-4">
                {[
                  { l: "Reactions", v: eng.reactions },
                  { l: "Comments", v: eng.comments },
                  { l: "Shares", v: eng.shares },
                  { l: "Saves", v: eng.saves },
                ].map((t) => (
                  <div key={t.l} className="bg-card px-3 py-[10px]">
                    <div className="text-[10px] uppercase tracking-[0.03em] text-muted-2">{t.l}</div>
                    <div className="num text-[17px] font-semibold tracking-[-0.02em] text-ink">{fmtK(t.v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* audience — real synced breakdown when available, else the mock profile */}
      <div>
        <div className="mb-[14px] text-[12px] font-semibold text-slate">
          ใครเห็นครีเอทีฟนี้ · Audience breakdown
        </div>
        <AudienceBreakdown profile={creative.audience ?? CREATIVE_PROFILES[creative.profileKey]} />
      </div>
    </Card>
  );
}
