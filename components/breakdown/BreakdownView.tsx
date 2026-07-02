"use client";

import { useEffect, useState } from "react";
import {
  getBreakdown,
  getProductBreakdown,
  getProductsInAccount,
  type BreakdownData,
  type ProductInAccount,
} from "@/lib/api";
import { fmtMetric, fmtMoney } from "@/lib/format";
import { useAppStore, usePerfColor } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { AudienceBreakdown } from "@/components/charts/AudienceBreakdown";
import { HeatFooter, heatCellTitle } from "@/components/charts/HeatFooter";
import type { AudienceProfile } from "@/data/types";

const CLOSE_LABEL: Record<string, string> = { OFF: "ปิด", SUGGEST: "แนะนำ", AUTO: "อัตโนมัติ" };

export function BreakdownView() {
  const range = useAppStore((s) => s.range);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const [bd, setBd] = useState<BreakdownData | null>(null);
  const [products, setProducts] = useState<ProductInAccount[] | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [prodResult, setProdResult] = useState<{ sku: string; profile: AudienceProfile | null } | null>(null);
  const pc = usePerfColor();

  // re-fetch whenever the global range or account filter (top bar) changes
  useEffect(() => {
    let alive = true;
    getBreakdown(range, accountFilter).then((d) => alive && setBd(d)).catch(() => {});
    getProductsInAccount(accountFilter, range)
      .then((p) => {
        if (!alive) return;
        setProducts(p);
        // drop a product selection that isn't in the current account/range
        setSelectedSku((cur) => (cur && p.some((x) => x.sku === cur) ? cur : null));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [range, accountFilter]);

  // a selected product's aggregated audience profile (keyed by sku → render shows
  // a loading state until the result for the current sku arrives)
  useEffect(() => {
    if (!selectedSku) return;
    let alive = true;
    getProductBreakdown(selectedSku, accountFilter, range)
      .then((p) => alive && setProdResult({ sku: selectedSku, profile: p }))
      .catch(() => alive && setProdResult({ sku: selectedSku, profile: null }));
    return () => {
      alive = false;
    };
  }, [selectedSku, accountFilter, range]);

  const selectedName = products?.find((p) => p.sku === selectedSku)?.name ?? selectedSku;
  const prodReady = !!prodResult && prodResult.sku === selectedSku;

  const productsCard = (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-2 px-5 py-[14px]">
        <div className="text-section-title">
          สินค้าในบัญชีนี้ · Products in this account
          {accountFilter === "all" && <span className="ml-2 text-[11px] font-normal text-muted-2">(ทุกบัญชี)</span>}
        </div>
        <span className="num text-[11.5px] text-muted">{products?.length ?? 0} สินค้า</span>
      </div>
      {products && products.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-muted-2">
          ยังไม่มีสินค้าที่ผูกกับบัญชีนี้ · No products mapped in this account
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-field-bg text-[10.5px] uppercase tracking-[0.02em] text-muted">
                <th className="px-5 py-[9px] text-left font-semibold">สินค้า · Product</th>
                <th className="px-3 py-[9px] text-left font-semibold">หมวดหมู่</th>
                <th className="px-3 py-[9px] text-right font-semibold">แคมเปญ</th>
                <th className="px-3 py-[9px] text-right font-semibold">Spend</th>
                <th className="px-3 py-[9px] text-right font-semibold">ROAS</th>
                <th className="px-4 py-[9px] text-left font-semibold">โหมดปิด</th>
              </tr>
            </thead>
            <tbody>
              {!products && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-[12px] text-muted-2">กำลังโหลด…</td>
                </tr>
              )}
              {(products ?? []).map((p) => (
                <tr
                  key={p.sku}
                  onClick={() => setSelectedSku((cur) => (cur === p.sku ? null : p.sku))}
                  className={`cursor-pointer border-t border-border-2 transition-colors ${
                    selectedSku === p.sku ? "bg-[#f5f8ff]" : "hover:bg-field-bg"
                  }`}
                >
                  <td className="px-5 py-[10px]">
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="num text-[10.5px] text-muted-2">{p.sku}</div>
                  </td>
                  <td className="px-3 py-[10px] text-ink-2">{p.category}</td>
                  <td className="num px-3 py-[10px] text-right text-ink-2">{p.campaigns}</td>
                  <td className="num px-3 py-[10px] text-right text-ink-2">{fmtMoney(p.spend)}</td>
                  <td className="num px-3 py-[10px] text-right font-semibold" style={{ color: pc(p.roas) }}>
                    {fmtMetric("roas", p.roas)}
                  </td>
                  <td className="px-4 py-[10px] text-[11.5px] text-muted">{CLOSE_LABEL[p.closeMode] ?? p.closeMode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  let audience: React.ReactNode;
  if (selectedSku) {
    audience = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-section-title">
            กลุ่มเป้าหมายของ · Audience of <span className="text-accent">{selectedName}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSku(null)}
            className="rounded-input border border-[#dde1e7] bg-card px-[12px] py-[6px] text-[12px] font-medium text-ink"
          >
            ✕ ดูทั้งบัญชี · Back to account
          </button>
        </div>
        {!prodReady ? (
          <Card className="h-[260px] animate-pulse" />
        ) : prodResult?.profile ? (
          <Card className="p-5">
            <AudienceBreakdown profile={prodResult.profile} />
          </Card>
        ) : (
          <Card className="flex h-[200px] items-center justify-center p-5 text-center text-[12.5px] text-muted-2">
            ไม่มีข้อมูลกลุ่มเป้าหมายของสินค้านี้ในช่วงนี้ · No audience data for this product in the selected range
          </Card>
        )}
      </div>
    );
  } else if (!bd) {
    audience = (
      <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
        <Card className="h-[240px]" />
      </div>
    );
  } else if (bd.age.every((a) => a[1] === 0) && bd.province.length === 0) {
    audience = (
      <Card className="flex h-[200px] items-center justify-center p-5 text-center text-[12.5px] text-muted-2">
        {accountFilter === "all"
          ? "ยังไม่มีข้อมูลกลุ่มเป้าหมาย — กดซิงค์ในหน้าตั้งค่า · No audience data yet — run a sync in Settings"
          : "ไม่มีการแสดงผลของบัญชีนี้ในช่วงเวลานี้ · This account had no delivery in the selected range"}
      </Card>
    );
  } else {
    const ageMax = Math.max(1, ...bd.age.map((a) => a[1]));
    const provMax = Math.max(1, ...bd.province.map((p) => p[1]));
    audience = (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Age */}
        <Card className="px-5 py-[18px]">
          <Title>ช่วงอายุ · Age</Title>
          <div className="flex h-[150px] items-end gap-3">
            {bd.age.map(([label, pct, roas]) => (
              <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
                <div className="num text-[10.5px] font-semibold" style={{ color: pc(roas) }}>
                  {fmtMetric("roas", roas)}
                </div>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-[4px] bg-accent" style={{ height: `${(pct / ageMax) * 100}%` }} />
                </div>
                <div className="num text-[10.5px] text-ink">{pct}%</div>
                <div className="text-[10px] text-muted-2">{label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Gender */}
        <Card className="px-5 py-[18px]">
          <Title>เพศ · Gender</Title>
          <div className="flex flex-col gap-[15px]">
            {bd.gender.map(([label, pct, roas, color]) => (
              <div key={label}>
                <div className="mb-[6px] flex items-center gap-2">
                  <span className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]" style={{ background: color }} />
                  <span className="flex-1 text-[12px] text-ink-2">{label}</span>
                  <span className="num text-[11px]" style={{ color: pc(roas) }}>{fmtMetric("roas", roas)}</span>
                  <span className="num w-[42px] text-right text-[12px] font-semibold">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-[5px] bg-[#f0f1f3]">
                  <div className="h-full rounded-[5px]" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Provinces */}
        <Card className="px-5 py-[18px]">
          <Title>จังหวัด · Top provinces</Title>
          <div className="flex flex-col gap-[11px]">
            {bd.province.map(([label, pct, roas]) => (
              <div key={label} className="flex items-center gap-[10px]">
                <span className="w-[150px] flex-shrink-0 text-[11.5px] text-ink-2">{label}</span>
                <div className="flex flex-1 items-center gap-[10px]">
                  <div className="h-2 min-w-[4px] flex-1">
                    <div className="h-full rounded-[5px] bg-accent" style={{ width: `${(pct / provMax) * 100}%` }} />
                  </div>
                  <span className="num w-[34px] text-right text-[11px] font-semibold text-ink">{pct}%</span>
                  <span className="num w-[42px] text-right text-[11px]" style={{ color: pc(roas) }}>
                    {fmtMetric("roas", roas)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Heatmap */}
        <Card className="px-5 py-[18px]">
          <Title>วัน × เวลา · Day × time</Title>
          <div className="flex flex-col gap-[5px]">
            {bd.heat.grid.map((row, i) => (
              <div key={i} className="flex items-center gap-[6px]">
                <span className="w-[18px] text-center text-[10.5px] text-muted">{bd.heat.days[i]}</span>
                <div className="flex flex-1 gap-1">
                  {row.map((v, j) => (
                    <div
                      key={j}
                      className="group relative h-[22px] flex-1 rounded-[3px] transition-shadow hover:ring-2 hover:ring-inset hover:ring-ink/30"
                      style={{ background: `rgb(var(--accent-rgb) / ${(0.05 + (v / 100) * 0.92).toFixed(3)})` }}
                    >
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-ink px-[7px] py-1 text-[10.5px] text-white shadow-dropdown group-hover:block">
                        {heatCellTitle(i, j)} <span className="num text-white/70">· {v}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <HeatFooter />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {productsCard}
      {audience}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="mb-[16px] text-section-title">{children}</div>;
}
