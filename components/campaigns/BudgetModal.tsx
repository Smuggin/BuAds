"use client";

import { budgetSummary, scaleBudgetByPct, type CampaignState } from "@/lib/kpi";
import { fmtMoney } from "@/lib/format";
import { usePerfColor } from "@/store/AppProvider";
import type { Campaign, Product } from "@/data/types";

const PCTS = [25, 50, 75, 100];

interface Props {
  campaign: Campaign;
  product: Product;
  accountTh: string;
  current: number;
  draft: number;
  state: CampaignState;
  onSetDraft: (v: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function BudgetModal({
  campaign,
  product,
  accountTh,
  current,
  draft,
  state,
  onSetDraft,
  onConfirm,
  onClose,
}: Props) {
  const pc = usePerfColor();
  const { diff, pct, monthly, util } = budgetSummary(current, draft, campaign.metrics.cost);
  const up = diff > 0;
  const down = diff < 0;
  const accent = up ? "#1f8a5b" : down ? "#d6453d" : "#3b6fe0";
  const arrowBig = up ? "↗" : down ? "↘" : "→";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,29,.55)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full overflow-hidden rounded-[16px] bg-card shadow-modal"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-2 px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">
              ปรับงบแคมเปญ · Adjust budget
            </div>
            <div className="mt-[2px] text-[12.5px] text-muted">{campaign.name}</div>
            <div className="mt-[1px] text-[11.5px] text-muted-2">
              {product.th} · {campaign.sku} · {accountTh}
            </div>
          </div>
          <span
            className="rounded-pill px-[11px] py-1 text-[12px] font-bold"
            style={{ background: accent + "18", color: accent }}
          >
            {up ? "เพิ่มงบ" : down ? "ลดงบ" : "ไม่เปลี่ยน"}
          </span>
        </div>

        <div className="flex flex-col gap-[18px] px-[22px] py-5">
          {/* current → draft */}
          <div className="flex items-center justify-between gap-[14px]">
            <div className="text-center">
              <div className="mb-[5px] text-[10.5px] uppercase tracking-[0.04em] text-muted-2">
                งบปัจจุบัน/วัน
              </div>
              <div className="num text-[22px] font-semibold text-muted">{fmtMoney(current)}</div>
            </div>
            <div className="text-[26px]" style={{ color: accent }}>
              {arrowBig}
            </div>
            <div className="text-center">
              <div className="mb-[5px] text-[10.5px] uppercase tracking-[0.04em] text-muted-2">
                งบใหม่/วัน
              </div>
              <input
                type="number"
                value={draft}
                onChange={(e) => onSetDraft(Math.max(0, Math.round(parseFloat(e.target.value) || 0)))}
                className="num w-[140px] rounded-[10px] border-2 px-3 py-[10px] text-right text-[22px] font-bold text-ink"
                style={{ borderColor: accent }}
              />
            </div>
          </div>

          {/* quick increase */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.04em] text-muted-2">
                เพิ่มงบจากปัจจุบัน
              </span>
              <div className="flex items-center gap-[6px]">
                <button
                  type="button"
                  onClick={() => onSetDraft(Math.max(0, draft - 100))}
                  className="h-7 w-[30px] rounded-[7px] border border-[#dde1e7] bg-card text-[15px] text-ink"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onSetDraft(Math.max(0, draft + 100))}
                  className="h-7 w-[30px] rounded-[7px] border border-[#dde1e7] bg-card text-[15px] text-ink"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              {PCTS.map((p) => {
                const target = scaleBudgetByPct(current, p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSetDraft(target)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-control border border-[#dde1e7] bg-card py-[9px] text-[13px] font-bold text-success hover:border-success hover:bg-[#e7f5ee]"
                  >
                    +{p}%{draft === target && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* diff + monthly */}
          <div className="flex items-center justify-between rounded-[10px] bg-[#f7f8fa] px-[15px] py-3">
            <div>
              <div className="text-[11px] text-muted-2">ส่วนต่าง</div>
              <div className="num font-bold" style={{ color: accent }}>
                {up ? "+" : ""}
                {fmtMoney(diff)} · {up ? "+" : ""}
                {pct.toFixed(0)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-2">งบรายเดือน (×30)</div>
              <div className="num text-[14px] font-semibold text-ink">{fmtMoney(monthly)}</div>
            </div>
          </div>

          {/* current performance */}
          <div>
            <div className="mb-[9px] text-[11px] uppercase tracking-[0.04em] text-muted-2">
              ผลงานปัจจุบัน · ตรวจสอบก่อนยืนยัน
            </div>
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2">
              <Mini label="ROAS" value={`${Math.round(campaign.metrics.roas * 10) / 10}x`} color={pc(campaign.metrics.roas)} />
              <Mini label="CPA" value={fmtMoney(campaign.metrics.cpa)} />
              <Mini label="ใช้จริง/วัน" value={fmtMoney(campaign.metrics.cost)} />
              <Mini label="ใช้งบ" value={`${util}%`} />
            </div>
            <div className="mt-[9px] flex items-center gap-[7px]">
              <span
                className="rounded-pill px-[9px] py-1 text-[11px] font-semibold"
                style={{ background: state.statusColor + "18", color: state.statusColor }}
              >
                {state.statusIcon} {state.statusLabel}
              </span>
              <span className="text-[11px] text-muted-2">
                {util > 100 ? "งบปัจจุบันไม่พอ — ระบบจำกัดที่งบ" : `ใช้จริง ${fmtMoney(campaign.metrics.cost)}/วัน`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-[10px] border-t border-border-2 px-[22px] py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-[#dde1e7] bg-card px-5 py-3 text-[13.5px] font-medium text-ink"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-[10px] border-none py-3 text-[13.5px] font-semibold text-white"
            style={{ background: accent }}
          >
            ยืนยันปรับงบ— {fmtMoney(draft)}/วัน
          </button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card px-[10px] py-[9px]">
      <div className="text-[9.5px] uppercase text-muted-2">{label}</div>
      <div className="num text-[13.5px] font-medium" style={{ color: color ?? "#3a3f47" }}>
        {value}
      </div>
    </div>
  );
}
