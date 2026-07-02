"use client";

import { fmtMoney } from "@/lib/format";
import type { CampaignChangeResult } from "@/lib/api";

/** A staged edit for one campaign — a status flip and/or a budget change. */
export interface PendingChange {
  id: string; // metaCampaignId
  name: string;
  accountTh?: string;
  statusFrom?: boolean; // current on/off (undefined = no status change)
  statusTo?: boolean;
  budgetFrom?: number; // THB (undefined = no budget change)
  budgetTo?: number;
}

interface Props {
  changes: PendingChange[];
  saving: boolean;
  results: CampaignChangeResult[] | null;
  onConfirm: () => void;
  onClose: () => void;
}

const StatusPill = ({ on }: { on: boolean }) => (
  <span
    className="rounded-pill px-[8px] py-[2px] text-[11px] font-semibold"
    style={{ background: on ? "rgba(31,138,91,.14)" : "rgba(107,114,128,.16)", color: on ? "#1f8a5b" : "#6b7280" }}
  >
    {on ? "เปิด · ON" : "ปิด · OFF"}
  </span>
);

export function ConfirmChangesModal({ changes, saving, results, onConfirm, onClose }: Props) {
  const resById = new Map((results ?? []).map((r) => [r.id, r]));
  const failed = (results ?? []).filter((r) => !r.ok);

  return (
    <div
      onClick={saving ? undefined : onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,29,.55)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[16px] bg-card shadow-modal"
      >
        <div className="border-b border-border-2 px-[22px] py-[18px]">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">
            ยืนยันการเปลี่ยนแปลง · Review changes
          </div>
          <div className="mt-[2px] text-[12.5px] text-muted">
            จะเขียนกลับไปที่ Meta ทันที · {changes.length} แคมเปญ · writes to Meta on confirm
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] py-4">
          <div className="flex flex-col gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2">
            {changes.map((c) => {
              const res = resById.get(c.id);
              return (
                <div key={c.id} className="bg-card px-[14px] py-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ink">{c.name}</div>
                      {c.accountTh && <div className="text-[11px] text-muted-2">{c.accountTh}</div>}
                    </div>
                    {res && (
                      <span
                        className="flex-shrink-0 rounded-pill px-[9px] py-[2px] text-[11px] font-semibold"
                        style={{
                          background: res.ok ? "rgba(31,138,91,.14)" : "rgba(214,69,61,.14)",
                          color: res.ok ? "#1f8a5b" : "#d6453d",
                        }}
                      >
                        {res.ok ? "✓ สำเร็จ" : "✕ ล้มเหลว"}
                      </span>
                    )}
                  </div>
                  <div className="mt-[6px] flex flex-wrap items-center gap-x-[18px] gap-y-[6px]">
                    {c.statusTo !== undefined && (
                      <div className="flex items-center gap-[7px] text-[12px]">
                        <span className="text-[10.5px] uppercase tracking-[0.03em] text-muted-2">สถานะ</span>
                        <StatusPill on={!!c.statusFrom} />
                        <span className="text-muted-2">→</span>
                        <StatusPill on={!!c.statusTo} />
                      </div>
                    )}
                    {c.budgetTo !== undefined && (
                      <div className="flex items-center gap-[7px] text-[12px]">
                        <span className="text-[10.5px] uppercase tracking-[0.03em] text-muted-2">งบ/วัน</span>
                        <span className="num font-semibold text-muted">{fmtMoney(c.budgetFrom ?? 0)}</span>
                        <span className="text-muted-2">→</span>
                        <span className="num font-bold text-accent">{fmtMoney(c.budgetTo)}</span>
                      </div>
                    )}
                  </div>
                  {res && !res.ok && res.error && (
                    <div className="mt-[5px] text-[11px] text-danger">{res.error}</div>
                  )}
                </div>
              );
            })}
          </div>
          {results && failed.length > 0 && (
            <div className="mt-3 rounded-[8px] bg-[rgba(214,69,61,.08)] px-[14px] py-[10px] text-[12px] text-danger">
              {failed.length} รายการล้มเหลว — แก้ไขแล้วลองบันทึกอีกครั้ง · {failed.length} failed, still staged for retry
            </div>
          )}
        </div>

        <div className="flex gap-[10px] border-t border-border-2 px-[22px] py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[10px] border border-[#dde1e7] bg-card px-5 py-3 text-[13.5px] font-medium text-ink disabled:opacity-50"
          >
            {results ? "ปิด" : "ยกเลิก"}
          </button>
          {!results && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="flex-1 rounded-[10px] border-none bg-accent py-3 text-[13.5px] font-semibold text-white disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : `ยืนยันบันทึก ${changes.length} รายการ · Confirm`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
