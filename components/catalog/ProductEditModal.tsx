"use client";

import { useAppStore } from "@/store/AppProvider";
import { allCategories } from "@/lib/resolvers";
import { DEFAULT_CATEGORIES } from "@/data/categories";
import { Icon } from "@/components/icons/Icon";
import { AccountChips } from "./AccountChips";
import type { AccountKey } from "@/data/types";

export function ProductEditModal() {
  const m = useAppStore((s) => s.editModal);
  const customCats = useAppStore((s) => s.customCats);
  const setEdit = useAppStore((s) => s.setEdit);
  const toggleEditAccount = useAppStore((s) => s.toggleEditAccount);
  const saveEdit = useAppStore((s) => s.saveEdit);
  const closeEdit = useAppStore((s) => s.closeEdit);

  if (!m) return null;
  const cats = allCategories(DEFAULT_CATEGORIES, customCats);
  const canSave = !!(m.th.trim() && m.cost);

  const onSave = () => {
    if (!canSave) return;
    saveEdit(m.sku, {
      th: m.th.trim(),
      en: m.en.trim() || m.th.trim(),
      category: m.cat,
      unitCost: Math.round(parseFloat(m.cost) || 0),
      img: m.img,
      accounts: m.accounts,
    });
  };

  return (
    <div
      onClick={closeEdit}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,29,.55)] p-6 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-[460px] max-w-full flex-col overflow-hidden rounded-[16px] bg-card shadow-modal"
      >
        <div className="flex items-center justify-between border-b border-border-2 px-[22px] py-4">
          <div className="text-[16px] font-semibold">แก้ไขสินค้า · {m.sku}</div>
          <button type="button" onClick={closeEdit} aria-label="ปิด" className="h-[30px] w-[30px] rounded-input bg-[#f0f1f3] text-[15px] text-slate">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-[14px] overflow-y-auto px-[22px] py-5">
          <PhotoField img={m.img} onPick={(d) => setEdit("img", d)} onClear={() => setEdit("img", null)} />
          <Field label="ชื่อสินค้า (ไทย) *">
            <input value={m.th} onChange={(e) => setEdit("th", e.target.value)} className={inputCls} />
          </Field>
          <Field label="ชื่อสินค้า (English)">
            <input value={m.en} onChange={(e) => setEdit("en", e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ต้นทุน/ชิ้น (฿) *">
              <input type="number" value={m.cost} onChange={(e) => setEdit("cost", e.target.value)} className={`num ${inputCls}`} />
            </Field>
            <Field label="หมวดหมู่">
              <select value={m.cat} onChange={(e) => setEdit("cat", e.target.value)} className={inputCls}>
                {cats.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="บัญชีที่ใช้">
            <AccountChips selected={m.accounts} onToggle={(k: AccountKey) => toggleEditAccount(k)} />
          </Field>
        </div>

        <div className="flex gap-[10px] border-t border-border-2 px-[22px] py-4">
          <button type="button" onClick={closeEdit} className="rounded-[10px] border border-[#dde1e7] bg-card px-5 py-3 text-[13.5px] font-medium text-ink">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="flex-1 rounded-[10px] border-none py-3 text-[13.5px] font-semibold text-white"
            style={{ background: canSave ? "#16181d" : "#cdd1d8", cursor: canSave ? "pointer" : "not-allowed" }}
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-input border border-[#dde1e7] bg-card px-[10px] py-[9px] text-[13px] text-ink";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">{label}</span>
      {children}
    </label>
  );
}

export function PhotoField({
  img,
  onPick,
  onClear,
}: {
  img: string | null;
  onPick: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onPick(String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <div>
      {img ? (
        <div className="relative overflow-hidden rounded-[10px] border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="preview" className="h-[150px] w-full object-cover" />
          <button type="button" onClick={onClear} className="absolute right-2 top-2 rounded-md bg-ink/70 px-2 py-1 text-[11px] text-white">
            ล้างรูป
          </button>
        </div>
      ) : (
        <label className="flex h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#cdd1d8] bg-field-bg text-muted-2">
          <Icon name="upload" size={24} />
          <span className="text-[12px]">อัปโหลดรูปสินค้า</span>
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
