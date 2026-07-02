"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { getProducts, patchProduct, reorderProducts } from "@/lib/api";
import { KPI_METRIC_DEFS, METRIC_DEFS, RAMP } from "@/lib/constants";
import { NumberField } from "@/components/ui/NumberField";
import { SaveChangesBar } from "@/components/ui/SaveChangesBar";
import { effCloseMode, effSkipMetrics, effThresholds } from "@/lib/resolvers";
import { dirSymbol } from "@/lib/format";
import { useAppStore } from "@/store/AppProvider";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import type { CloseMode, MetricKey, Product } from "@/data/types";

const CLOSE_OPTS: [CloseMode, string][] = [
  ["OFF", "ปิด · Off"],
  ["SUGGEST", "แนะนำ · Suggest"],
  ["AUTO", "อัตโนมัติ · Auto"],
];
const CLOSE_LABEL: Record<CloseMode, string> = { OFF: "Off", SUGGEST: "Suggest", AUTO: "Auto" };

// KPI metrics judged per product. CPA + Cost/วัน are intentionally excluded here.
// Labels mirror Meta Business Suite wording.
const META_LABEL: Partial<Record<MetricKey, string>> = {
  roas: "Purchase ROAS",
  ctr: "CTR (all)",
  cpm: "CPM",
  cpp: "Cost per purchase",
  cpr: "Cost per result",
};
const KPI_METRICS = KPI_METRIC_DEFS; // shared with the campaign table (constants)
const kpiKeys = KPI_METRICS.map((m) => m.key as MetricKey);
const fmtVal = (key: MetricKey, v: number) => {
  const m = METRIC_DEFS.find((d) => d.key === key)!;
  return `${m.money ? "฿" : ""}${v}${m.suffix}`;
};

interface ProductChange {
  sku: string;
  name: string;
  thresholds: { key: MetricKey; from: number; to: number }[];
  skip?: { from: MetricKey[]; to: MetricKey[] };
  close?: { from: CloseMode; to: CloseMode };
}

export function ProductKpiView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragSku, setDragSku] = useState<string | null>(null);
  const prodThr = useAppStore((s) => s.prodThr);
  const closeOverride = useAppStore((s) => s.closeOverride);
  const skipOverride = useAppStore((s) => s.skipOverride);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const setCloseMode = useAppStore((s) => s.setCloseMode);
  const setSkipMetrics = useAppStore((s) => s.setSkipMetrics);
  const clearKpiDrafts = useAppStore((s) => s.clearKpiDrafts);

  useEffect(() => {
    let alive = true;
    getProducts().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);

  // toggle whether a metric is enforced for a product (draft only — persisted on Save)
  const toggleMetric = (sku: string, key: MetricKey, current: MetricKey[], enforce: boolean) => {
    setSkipMetrics(sku, enforce ? current.filter((k) => k !== key) : [...current, key]);
  };

  // Diff drafts (store overrides) against the saved products → the pending changes.
  const changes: ProductChange[] = useMemo(() => {
    if (!products) return [];
    const out: ProductChange[] = [];
    for (const p of products) {
      const effThr = effThresholds(p, prodThr);
      const thrDiffs = kpiKeys
        .filter((k) => effThr[k] !== p.thresholds[k])
        .map((k) => ({ key: k, from: p.thresholds[k], to: effThr[k] }));

      const effSkip = effSkipMetrics(p, skipOverride);
      const baseSkip = p.skipMetrics ?? [];
      const skipChanged =
        effSkip.length !== baseSkip.length || effSkip.some((k) => !baseSkip.includes(k));

      const effClose = effCloseMode(p, closeOverride);
      const closeChanged = effClose !== p.closeMode;

      if (thrDiffs.length || skipChanged || closeChanged) {
        out.push({
          sku: p.sku,
          name: p.th,
          thresholds: thrDiffs,
          skip: skipChanged ? { from: baseSkip, to: effSkip } : undefined,
          close: closeChanged ? { from: p.closeMode, to: effClose } : undefined,
        });
      }
    }
    return out;
  }, [products, prodThr, skipOverride, closeOverride]);

  const onSave = async () => {
    setSaving(true);
    try {
      for (const c of changes) {
        const patch: {
          thresholds?: Partial<Record<MetricKey, number>>;
          skipMetrics?: MetricKey[];
          closeMode?: CloseMode;
        } = {};
        if (c.thresholds.length) {
          patch.thresholds = Object.fromEntries(c.thresholds.map((d) => [d.key, d.to]));
        }
        if (c.skip) patch.skipMetrics = c.skip.to;
        if (c.close) patch.closeMode = c.close.to;
        await patchProduct(c.sku, patch);
      }
      const fresh = await getProducts();
      setProducts(fresh);
      clearKpiDrafts(); // drafts now match the DB
      setConfirmOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ · Save failed");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => clearKpiDrafts();

  // Drag-to-reorder rows. Reorders live on hover; persists the new order on drop.
  const onDragOverRow = (e: DragEvent, overSku: string) => {
    e.preventDefault();
    if (!dragSku || dragSku === overSku || !products) return;
    const from = products.findIndex((p) => p.sku === dragSku);
    const to = products.findIndex((p) => p.sku === overSku);
    if (from < 0 || to < 0) return;
    const next = [...products];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setProducts(next);
  };
  const onDropRow = () => {
    if (products) reorderProducts(products.map((p) => p.sku)).catch(() => {});
    setDragSku(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Banner
        title="เกณฑ์ตัดสินรายสินค้า · KPI thresholds"
        subtitle="ตั้งเพดานที่ยอมรับได้ของแต่ละสินค้า — แก้แล้วดูผลทันที กด บันทึก เพื่อยืนยัน"
      >
        <Link
          href="/campaigns"
          className="rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
        >
          ไปหน้าแคมเปญ →
        </Link>
      </Banner>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-2 px-5 py-4">
          <div>
            <div className="text-section-title">เกณฑ์ตัดสินรายสินค้า · KPI thresholds</div>
            <div className="text-[12px] text-muted">
              Purchase ROAS / CTR เป็นค่าต่ำสุด (≥) · ต้นทุนเป็นค่าสูงสุด (≤) · ติ๊กถูก = ใช้เกณฑ์, เอาออก = ข้าม
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-field-bg text-[10.5px] uppercase tracking-[0.02em] text-muted">
                <th className="w-[26px] py-[10px]" aria-hidden="true" />
                <th className="py-[10px] pr-5 text-left font-semibold">สินค้า · Product</th>
                {KPI_METRICS.map((m) => (
                  <th key={m.key} className="px-[10px] py-[10px] text-right font-semibold">
                    {META_LABEL[m.key as MetricKey] ?? m.short}{" "}
                    <span className="num text-faint">{dirSymbol(m.dir)}</span>
                  </th>
                ))}
                <th className="px-4 py-[10px] text-center font-semibold">เมื่อเกินเกณฑ์ · On breach</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((p, pi) => {
                const thr = effThresholds(p, prodThr);
                const mode = effCloseMode(p, closeOverride);
                const skip = effSkipMetrics(p, skipOverride);
                return (
                  <tr
                    key={p.sku}
                    onDragOver={(e) => onDragOverRow(e, p.sku)}
                    onDrop={onDropRow}
                    className="border-t border-border-2 transition-opacity"
                    style={{ opacity: dragSku === p.sku ? 0.4 : 1 }}
                  >
                    <td className="pl-4 pr-1 py-3 align-middle">
                      <span
                        draggable
                        onDragStart={() => setDragSku(p.sku)}
                        onDragEnd={() => setDragSku(null)}
                        title="ลากเพื่อจัดลำดับ · Drag to reorder"
                        aria-label="ลากเพื่อจัดลำดับ · Drag to reorder"
                        className="flex h-6 w-5 cursor-grab items-center justify-center text-[15px] leading-none text-faint hover:text-slate active:cursor-grabbing"
                      >
                        ⠿
                      </span>
                    </td>
                    <td className="py-3 pr-5">
                      <div className="flex items-center gap-[11px]">
                        <div
                          className="num flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-input text-[10px] font-semibold text-white"
                          style={{ background: RAMP[pi % RAMP.length] }}
                        >
                          {p.sku.slice(0, 2)}
                        </div>
                        <div className="leading-[1.2]">
                          <div className="font-semibold text-ink">{p.th}</div>
                          <div className="num text-[11px] text-muted-2">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    {KPI_METRICS.map((m) => {
                      const enforced = !skip.includes(m.key as MetricKey);
                      return (
                        <td key={m.key} className="px-[10px] py-3">
                          <div className="flex items-center justify-end gap-[7px]">
                            <input
                              type="checkbox"
                              checked={enforced}
                              aria-label={`ใช้เกณฑ์ ${META_LABEL[m.key as MetricKey] ?? m.short} กับ ${p.th}`}
                              title={enforced ? "ใช้เกณฑ์นี้ · enforced" : "ข้ามเกณฑ์นี้ · skipped (exception)"}
                              onChange={(e) => toggleMetric(p.sku, m.key as MetricKey, skip, e.target.checked)}
                              className="h-[13px] w-[13px] flex-shrink-0 cursor-pointer accent-accent"
                            />
                            <span className="transition-opacity" style={{ opacity: enforced ? 1 : 0.35 }}>
                              <ThresholdInput
                                money={m.money}
                                suffix={m.suffix}
                                value={thr[m.key as MetricKey]}
                                onChange={(v) => setThreshold(p.sku, m.key as MetricKey, v)}
                              />
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <select
                          value={mode}
                          aria-label={`โหมดปิด ${p.th}`}
                          onChange={(e) => setCloseMode(p.sku, e.target.value as CloseMode)}
                          className="rounded-[7px] border border-[#dde1e7] bg-card px-[8px] py-[6px] text-[12px] font-medium text-ink"
                        >
                          {CLOSE_OPTS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <SaveChangesBar
        count={changes.length}
        onSave={() => setConfirmOpen(true)}
        onDiscard={discard}
      />

      {confirmOpen && (
        <div
          onClick={() => !saving && setConfirmOpen(false)}
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
                {changes.length} สินค้า · ตัดสินแคมเปญใหม่ทันทีหลังบันทึก · re-judges campaigns on save
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-[22px] py-4">
              <div className="flex flex-col gap-px overflow-hidden rounded-[10px] border border-border-2 bg-border-2">
                {changes.map((c) => (
                  <div key={c.sku} className="bg-card px-[14px] py-[11px]">
                    <div className="text-[13px] font-semibold text-ink">
                      {c.name} <span className="num text-[11px] text-muted-2">· {c.sku}</span>
                    </div>
                    <div className="mt-[5px] flex flex-col gap-[3px] text-[12px] text-slate">
                      {c.thresholds.map((d) => (
                        <div key={d.key} className="num">
                          {META_LABEL[d.key] ?? d.key.toUpperCase()}:{" "}
                          <span className="text-muted-2">{fmtVal(d.key, d.from)}</span> →{" "}
                          <span className="font-semibold text-ink">{fmtVal(d.key, d.to)}</span>
                        </div>
                      ))}
                      {c.close && (
                        <div>
                          โหมดปิด · On breach:{" "}
                          <span className="text-muted-2">{CLOSE_LABEL[c.close.from]}</span> →{" "}
                          <span className="font-semibold text-ink">{CLOSE_LABEL[c.close.to]}</span>
                        </div>
                      )}
                      {c.skip && <div className="text-muted-2">ปรับรายการเกณฑ์ที่ข้าม · skip list updated</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-[10px] border-t border-border-2 px-[22px] py-4">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="rounded-[10px] border border-[#dde1e7] bg-card px-5 py-3 text-[13.5px] font-medium text-ink disabled:opacity-50"
              >
                ยกเลิก · Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex-1 rounded-[10px] border-none bg-accent py-3 text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? "กำลังบันทึก…" : `ยืนยันบันทึก ${changes.length} รายการ · Confirm`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThresholdInput({
  money,
  suffix,
  value,
  onChange,
}: {
  money: boolean;
  suffix: "" | "x" | "%";
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-[3px]">
      {money && <span className="text-[11px] text-faint">฿</span>}
      <NumberField
        value={value}
        onChange={onChange}
        min={0}
        className="num w-[64px] rounded-[7px] border border-[#dde1e7] bg-card px-[7px] py-[5px] text-right text-[12px] text-ink"
      />
      {suffix && <span className="text-[11px] text-faint">{suffix}</span>}
    </span>
  );
}
