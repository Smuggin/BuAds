"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProducts, patchProduct } from "@/lib/api";
import { METRIC_DEFS, RAMP } from "@/lib/constants";
import { effAutoClose, effThresholds } from "@/lib/resolvers";
import { dirSymbol } from "@/lib/format";
import { useAppStore } from "@/store/AppProvider";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import type { MetricKey, Product } from "@/data/types";

export function ProductKpiView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const prodThr = useAppStore((s) => s.prodThr);
  const autoOverride = useAppStore((s) => s.autoOverride);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const toggleAutoClose = useAppStore((s) => s.toggleAutoClose);

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
            ROAS / CTR เป็นค่าต่ำสุด (≥) · ส่วนต้นทุนเป็นค่าสูงสุด (≤)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-field-bg text-[10.5px] uppercase tracking-[0.02em] text-muted">
                <th className="px-5 py-[10px] text-left font-semibold">สินค้า · Product</th>
                {METRIC_DEFS.map((m) => (
                  <th key={m.key} className="px-[10px] py-[10px] text-right font-semibold">
                    {m.short}{" "}
                    <span className="num text-faint">{dirSymbol(m.dir)}</span>
                  </th>
                ))}
                <th className="px-4 py-[10px] text-center font-semibold">ปิดอัตโนมัติ</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((p, pi) => {
                const thr = effThresholds(p, prodThr);
                const auto = effAutoClose(p, autoOverride);
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
                    {METRIC_DEFS.map((m) => (
                      <td key={m.key} className="px-[10px] py-3 text-right">
                        <ThresholdInput
                          money={m.money}
                          suffix={m.suffix}
                          value={thr[m.key as MetricKey]}
                          onChange={(v) => {
                            setThreshold(p.sku, m.key as MetricKey, v); // optimistic (live re-judge)
                            patchProduct(p.sku, { thresholds: { [m.key]: v } }).catch(() => {}); // persist
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Toggle
                          on={auto}
                          onClick={() => {
                            toggleAutoClose(p.sku, p.autoClose); // optimistic
                            patchProduct(p.sku, { autoClose: !auto }).catch(() => {}); // persist
                          }}
                          label={`ปิดอัตโนมัติ ${p.th}`}
                        />
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
        className="num w-[54px] rounded-[7px] border border-[#dde1e7] bg-card px-[6px] py-[5px] text-right text-[12px] text-ink"
      />
      {suffix && <span className="text-[11px] text-faint">{suffix}</span>}
    </span>
  );
}
