"use client";

import { LOG_ACTOR_META, LOG_TYPE_META } from "@/lib/constants";
import { Icon, type IconName } from "@/components/icons/Icon";
import type { Campaign, LogEntry, Product } from "@/data/types";

interface Props {
  campaign: Campaign;
  product: Product;
  accountTh: string;
  entries: LogEntry[];
  onClose: () => void;
}

export function HistoryModal({ campaign, product, accountTh, entries, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,29,.55)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[84vh] w-[520px] max-w-full flex-col overflow-hidden rounded-[16px] bg-card shadow-modal"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-2 px-[22px] py-[18px]">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.01em]">ประวัติการทำงาน · History</div>
            <div className="mt-[2px] text-[12.5px] text-muted">{campaign.name}</div>
            <div className="mt-[1px] text-[11.5px] text-muted-2">
              {product.th} · {campaign.sku} · {accountTh} · {entries.length} รายการ
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="h-[30px] w-[30px] flex-shrink-0 rounded-input bg-[#f0f1f3] text-[15px] text-slate"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-[22px] pb-5 pt-2">
          {entries.length === 0 ? (
            <div className="py-10 text-center text-muted-2">
              <div className="mb-2 text-[26px]">◷</div>
              <div className="text-[13px]">ยังไม่มีประวัติสำหรับแคมเปญนี้</div>
            </div>
          ) : (
            entries.map((e) => {
              const tm = LOG_TYPE_META[e.type];
              const am = LOG_ACTOR_META[e.actor];
              return (
                <div key={e.id} className="flex items-start gap-[13px] border-b border-border-3 py-[14px]">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control"
                    style={{ background: tm.color + "18", color: tm.color }}
                  >
                    <Icon name={tm.icon as IconName} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{e.title}</div>
                    <div className="mt-[3px] text-[12px] text-muted">{e.detail}</div>
                    {e.actor === "auto" && e.ruleName && (
                      <div className="mt-1 text-[11px] text-violet">ทำงานโดยกฎ: {e.ruleName}</div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-[5px]">
                    <span className="num text-[11.5px] text-faint">{e.time}</span>
                    <span
                      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill px-2 py-[3px] text-[10.5px] font-semibold"
                      style={{ background: am.bg, color: am.color }}
                    >
                      <span
                        className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[7.5px] font-bold text-white"
                        style={{ background: am.color }}
                      >
                        {e.actor === "auto" ? <Icon name="bolt" size={10} /> : "avatar" in am ? am.avatar : "PJ"}
                      </span>
                      {am.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
