"use client";

import { extractProductSegment } from "@/lib/meta/productMatch";
import type { Campaign, Product } from "@/data/types";

interface Props {
  campaign: Campaign;
  products: Product[];
  draftSku: string;
  saving: boolean;
  onSetDraft: (sku: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AssignSkuModal({
  campaign,
  products,
  draftSku,
  saving,
  onSetDraft,
  onConfirm,
  onClose,
}: Props) {
  const detected = extractProductSegment(campaign.name);
  const changed = draftSku !== campaign.sku;
  const canSave = changed && !saving;

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
          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[-0.01em]">จับคู่สินค้า · Assign product</div>
            <div className="mt-[2px] truncate text-[12.5px] text-muted">{campaign.name}</div>
            <div className="mt-[1px] text-[11.5px] text-muted-2">
              ตรวจพบจากชื่อแคมเปญ: {detected || "—"}
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

        <div className="flex flex-col gap-[14px] px-[22px] py-5">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">
              สินค้า · Product
            </span>
            <select
              value={draftSku}
              onChange={(e) => onSetDraft(e.target.value)}
              className="w-full rounded-input border border-[#dde1e7] bg-card px-[10px] py-[9px] text-[13px] text-ink"
            >
              <option value="">ยังไม่จับคู่ · None</option>
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.th} · {p.sku}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11.5px] leading-[1.5] text-muted-2">
            ระบบจะจับคู่ให้อัตโนมัติจากชื่อภาษาไทยในชื่อแคมเปญตอนซิงก์ — ใช้ตัวเลือกนี้เมื่อจับคู่ผิดหรือยังไม่ได้จับคู่
          </p>
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
            disabled={!canSave}
            className="flex-1 rounded-[10px] border-none py-3 text-[13.5px] font-semibold text-white"
            style={{ background: canSave ? "#16181d" : "#cdd1d8", cursor: canSave ? "pointer" : "not-allowed" }}
          >
            {saving ? "กำลังบันทึก…" : draftSku ? "บันทึกการจับคู่" : "ยกเลิกการจับคู่"}
          </button>
        </div>
      </div>
    </div>
  );
}
