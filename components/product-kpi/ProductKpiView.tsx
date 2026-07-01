"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProducts, patchProduct } from "@/lib/api";
import { METRIC_DEFS, RAMP } from "@/lib/constants";
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

export function ProductKpiView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const prodThr = useAppStore((s) => s.prodThr);
  const closeOverride = useAppStore((s) => s.closeOverride);
  const skipOverride = useAppStore((s) => s.skipOverride);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const setCloseMode = useAppStore((s) => s.setCloseMode);
  const setSkipMetrics = useAppStore((s) => s.setSkipMetrics);

  // toggle whether a metric is enforced for a product (unchecked = skipped exception)
  const toggleMetric = (sku: string, key: MetricKey, current: MetricKey[], enforce: boolean) => {
    const next = enforce ? current.filter((k) => k !== key) : [...current, key];
    setSkipMetrics(sku, next);
    patchProduct(sku, { skipMetrics: next }).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    getProducts().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Banner
        title="เกณฑ์ตัดสินรายสินค้า · KPI thresholds"
        subtitle="ตั้งเพดานที่ยอมรับได้ของแต่ละสินค้า — แก้แล้วระบบจะตัดสินแคมเปญใหม่ทันที"
      >
        <Link
          href="/campaigns"
          className="rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
        >
          ไปหน้าแคมเปญ →
        </Link>
      </Banner>

      <Card className="overflow-hidden">
        <div className="border-b border-border-2 px-5 py-4">
          <div className="text-section-title">เกณฑ์ตัดสินรายสินค้า · KPI thresholds</div>
          <div className="text-[12px] text-muted">
            ROAS / CTR เป็นค่าต่ำสุด (≥) · ส่วนต้นทุนเป็นค่าสูงสุด (≤) · ติ๊กถูก = ใช้เกณฑ์, เอาออก = ข้าม (ยกเว้น)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-field-bg text-[10.5px] uppercase tracking-[0.02em] text-muted">
                <th className="px-5 py-[10px] text-left font-semibold">สินค้า · Product</th>
                {METRIC_DEFS.map((m) => (
                  <th key={m.key} className="px-[10px] py-[10px] text-right font-semibold">
                    {m.short}{" "}
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
                  <tr key={p.sku} className="border-t border-border-2">
                    <td className="px-5 py-3">
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
                    {METRIC_DEFS.map((m) => {
                      const enforced = !skip.includes(m.key as MetricKey);
                      return (
                        <td key={m.key} className="px-[10px] py-3">
                          <div className="flex items-center justify-end gap-[7px]">
                            <input
                              type="checkbox"
                              checked={enforced}
                              aria-label={`ใช้เกณฑ์ ${m.short} กับ ${p.th}`}
                              title={enforced ? "ใช้เกณฑ์นี้ · enforced" : "ข้ามเกณฑ์นี้ · skipped (exception)"}
                              onChange={(e) => toggleMetric(p.sku, m.key as MetricKey, skip, e.target.checked)}
                              className="h-[13px] w-[13px] flex-shrink-0 cursor-pointer accent-accent"
                            />
                            <span className="transition-opacity" style={{ opacity: enforced ? 1 : 0.35 }}>
                              <ThresholdInput
                                money={m.money}
                                suffix={m.suffix}
                                value={thr[m.key as MetricKey]}
                                onChange={(v) => {
                                  setThreshold(p.sku, m.key as MetricKey, v); // optimistic (live re-judge)
                                  patchProduct(p.sku, { thresholds: { [m.key]: v } }).catch(() => {}); // persist
                                }}
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
                          onChange={(e) => {
                            const v = e.target.value as CloseMode;
                            setCloseMode(p.sku, v); // optimistic (live re-judge)
                            patchProduct(p.sku, { closeMode: v }).catch(() => {}); // persist
                          }}
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
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isNaN(v) ? 0 : v);
        }}
        className="num w-[64px] rounded-[7px] border border-[#dde1e7] bg-card px-[7px] py-[5px] text-right text-[12px] text-ink"
      />
      {suffix && <span className="text-[11px] text-faint">{suffix}</span>}
    </span>
  );
}
