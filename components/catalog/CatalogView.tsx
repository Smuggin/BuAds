"use client";

import { useEffect, useState } from "react";
import { getProducts, createProduct, deleteProduct, getAccounts, type AccountOption } from "@/lib/api";
import { RAMP } from "@/lib/constants";
import { allCategories, effProduct } from "@/lib/resolvers";
import { fmtMoney } from "@/lib/format";
import { DEFAULT_CATEGORIES } from "@/data/categories";
import { useAppStore } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/icons/Icon";
import { AccountChips } from "./AccountChips";
import { Field, PhotoField, ProductEditModal } from "./ProductEditModal";
import type { AccountKey, Product } from "@/data/types";

const inputCls = "w-full rounded-input border border-[#dde1e7] bg-card px-[10px] py-[9px] text-[13px] text-ink";

export function CatalogView() {
  const [base, setBase] = useState<Product[] | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const newProd = useAppStore((s) => s.newProd);
  const customCats = useAppStore((s) => s.customCats);
  const prodEdits = useAppStore((s) => s.prodEdits);
  const editModal = useAppStore((s) => s.editModal);
  const setNewProd = useAppStore((s) => s.setNewProd);
  const toggleNewAccount = useAppStore((s) => s.toggleNewAccount);
  const resetNewProd = useAppStore((s) => s.resetNewProd);
  const openEdit = useAppStore((s) => s.openEdit);

  const [saving, setSaving] = useState(false);

  const refresh = () => getProducts().then(setBase);
  useEffect(() => {
    let alive = true;
    getProducts().then((p) => alive && setBase(p));
    getAccounts().then((a) => alive && setAccounts(a));
    return () => {
      alive = false;
    };
  }, []);

  if (!base) {
    return (
      <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-[440px]" />
        <Card className="h-[440px]" />
      </div>
    );
  }

  const cats = allCategories(DEFAULT_CATEGORIES, customCats);
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const canAdd = !!(newProd.th.trim() && newProd.cost) && !saving;
  const all = base;

  const onAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      await createProduct({
        sku: newProd.sku.trim() || undefined,
        th: newProd.th.trim(),
        category: newProd.cat,
        accounts: newProd.accounts,
        unitCost: Math.round(parseFloat(newProd.cost) || 0),
        img: newProd.img,
      });
      await refresh();
      resetNewProd();
    } catch (e) {
      alert(e instanceof Error ? e.message : "เพิ่มสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (sku: string) => {
    if (!confirm(`ลบสินค้า ${sku}?`)) return;
    try {
      await deleteProduct(sku);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_1fr]">
      {/* add form */}
      <Card className="flex flex-col gap-[14px] p-[18px]">
        <div className="text-section-title">เพิ่มสินค้า · Add product</div>
        <PhotoField img={newProd.img} onPick={(d) => setNewProd("img", d)} onClear={() => setNewProd("img", null)} />
        <Field label="ชื่อสินค้า *">
          <input value={newProd.th} onChange={(e) => setNewProd("th", e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ต้นทุน/ชิ้น (฿) *">
            <input type="number" value={newProd.cost} onChange={(e) => setNewProd("cost", e.target.value)} className={`num ${inputCls}`} />
          </Field>
          <Field label="หมวดหมู่">
            <select value={newProd.cat} onChange={(e) => setNewProd("cat", e.target.value)} className={inputCls}>
              {cats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="บัญชีที่ใช้">
          <AccountChips selected={newProd.accounts} onToggle={(k: AccountKey) => toggleNewAccount(k)} />
        </Field>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-[10px] py-3 text-[13.5px] font-semibold text-white"
          style={{ background: canAdd ? "#16181d" : "#cdd1d8", cursor: canAdd ? "pointer" : "not-allowed" }}
        >
          <Icon name="plus" size={16} /> {saving ? "กำลังบันทึก…" : "เพิ่มสินค้า"}
        </button>
      </Card>

      {/* grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {all.map((p0, i) => {
          const p = effProduct(p0, prodEdits);
          const edited = !!prodEdits[p0.sku];
          const badge = p0.custom ? "เพิ่มเอง" : edited ? "แก้ไขแล้ว" : "";
          return (
            <Card key={p0.sku} className="overflow-hidden">
              {p.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.img} alt={p.th} className="h-[128px] w-full object-cover" />
              ) : (
                <div
                  className="num flex h-[128px] items-center justify-center text-[17px] font-semibold text-white"
                  style={{ background: RAMP[i % RAMP.length] }}
                >
                  {p.sku.slice(0, 2)}
                </div>
              )}
              <div className="flex flex-col gap-2 p-[14px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{p.th}</div>
                    <div className="num truncate text-[11px] text-muted-2">{p.sku}</div>
                  </div>
                  {badge && (
                    <span className="flex-shrink-0 rounded-[5px] bg-[#eef1f6] px-2 py-[2px] text-[10px] font-semibold text-slate">
                      {badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-2">
                  {p.accounts.length ? p.accounts.map((k) => accName.get(k) ?? k).join(" · ") : "ยังไม่กำหนดบัญชี"}
                </div>
                <div className="flex items-center justify-between">
                  <span className="num text-[13px] font-semibold text-ink">{fmtMoney(p.unitCost)}</span>
                  <span className="rounded-[5px] bg-[#eef1f6] px-2 py-[2px] text-[10.5px] font-medium text-slate">{p.category}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openEdit({ sku: p0.sku, th: p.th, cat: p.category, cost: String(p.unitCost), img: p.img, accounts: [...p.accounts] })
                    }
                    className="inline-flex items-center gap-[6px] rounded-input border border-[#dde1e7] bg-card px-[10px] py-[6px] text-[11.5px] font-semibold text-ink"
                  >
                    <Icon name="gear" size={13} /> แก้ไข
                  </button>
                  {p0.custom && (
                    <button
                      type="button"
                      onClick={() => onDelete(p0.sku)}
                      className="rounded-input border border-[#f0d8d6] bg-[#fdf3f2] px-[10px] py-[6px] text-[11.5px] font-semibold text-danger"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editModal && <ProductEditModal onSaved={refresh} />}
    </div>
  );
}
