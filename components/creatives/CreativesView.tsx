"use client";

import { useEffect, useState } from "react";
import { getCampaigns, getCreatives, getProducts } from "@/lib/api";
import { FORMAT_META } from "@/lib/constants";
import { filterCreatives, skusInCreatives } from "@/lib/creatives";
import { fmtMoney, round1 } from "@/lib/format";
import { useAppStore, usePerfColor } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { CreativeDetail } from "./CreativeDetail";
import type { Campaign, Creative, Product } from "@/data/types";

export function CreativesView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [creatives, setCreatives] = useState<Creative[] | null>(null);

  const accountFilter = useAppStore((s) => s.accountFilter); // global top-bar scope
  const range = useAppStore((s) => s.range);
  const mediaProd = useAppStore((s) => s.mediaProd);
  const selectedCreative = useAppStore((s) => s.selectedCreative);
  const prodThr = useAppStore((s) => s.prodThr);
  const prodScale = useAppStore((s) => s.prodScale);
  const closeOverride = useAppStore((s) => s.closeOverride);
  const skipOverride = useAppStore((s) => s.skipOverride);
  const selectCreative = useAppStore((s) => s.selectCreative);
  const setMediaProd = useAppStore((s) => s.setMediaProd);
  const pc = usePerfColor();

  useEffect(() => {
    let alive = true;
    Promise.all([getProducts(), getCampaigns(range), getCreatives(range, accountFilter)]).then(
      ([p, c, cr]) => {
        if (!alive) return;
        setProducts(p);
        setCampaigns(c);
        setCreatives(cr);
      },
    );
    return () => {
      alive = false;
    };
  }, [range, accountFilter]);

  if (!products || !campaigns || !creatives) {
    return (
      <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-[312px_1fr]">
        <Card className="h-[400px]" />
        <Card className="h-[400px]" />
      </div>
    );
  }

  // Account scope + post-dedup are applied server-side (getCreatives); the product
  // filter stays page-local.
  const scopedSkus = skusInCreatives(creatives);
  const effProd = mediaProd !== "all" && !scopedSkus.has(mediaProd) ? "all" : mediaProd;
  const list = filterCreatives(creatives, effProd);
  const selected = list.find((c) => c.id === selectedCreative) ?? list[0];

  const onProd = (v: string) => {
    const next = filterCreatives(creatives, v);
    const sel = next.some((c) => c.id === selectedCreative)
      ? selectedCreative
      : (next[0]?.id ?? selectedCreative);
    setMediaProd(v, sel);
  };

  const prodOpts: [string, string][] = [
    ["all", "ทุกสินค้า · All products"],
    ...products.filter((p) => scopedSkus.has(p.sku)).map((p) => [p.sku, p.th] as [string, string]),
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[312px_1fr]">
      {/* left: filters + list */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border-2 p-3">
          <Select value={effProd} onChange={onProd} prefix="สินค้า: " opts={prodOpts} />
          <div className="num px-1 text-[11px] text-faint">
            {list.length}/{creatives.length} ครีเอทีฟ
          </div>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-muted-2">
              ไม่พบครีเอทีฟตามตัวกรอง
            </div>
          ) : (
            list.map((cr) => {
              const fm = FORMAT_META[cr.format];
              const on = cr.id === selected?.id;
              const thumb = cr.previewImageUrl ?? cr.thumbnailUrl;
              return (
                <button
                  key={cr.id}
                  type="button"
                  onClick={() => selectCreative(cr.id)}
                  className={`flex w-full items-center gap-3 border-t border-border-3 px-3 py-3 text-left transition-colors duration-bg ${on ? "bg-[#f5f8ff]" : "hover:bg-field-bg"}`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={cr.name}
                      loading="lazy"
                      className="h-[46px] w-[46px] flex-shrink-0 rounded-control object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-control text-[17px] text-white"
                      style={{ background: fm.color }}
                    >
                      {fm.icon}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[6px]">
                      <span className="truncate text-[13px] font-semibold text-ink">{cr.name}</span>
                      {cr.groupSize && cr.groupSize > 1 && (
                        <span
                          className="num flex-shrink-0 rounded-[4px] bg-field-bg px-[5px] py-[1px] text-[10px] font-semibold text-muted"
                          title={`รวมจาก ${cr.groupSize} โฆษณา · merged from ${cr.groupSize} ads`}
                        >
                          ×{cr.groupSize}
                        </span>
                      )}
                    </div>
                    <div className="num mt-1 flex items-center gap-[10px] text-[11.5px] text-muted">
                      <span style={{ color: pc(cr.roas) }}>{round1(cr.roas)}x</span>
                      <span>{round1(cr.ctr)}%</span>
                      <span>{fmtMoney(cr.spend)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* right: detail (empty until creatives are synced) */}
      {selected ? (
        <CreativeDetail
          creative={selected}
          products={products}
          campaigns={campaigns}
          prodThr={prodThr}
          prodScale={prodScale}
          closeOverride={closeOverride}
          skipOverride={skipOverride}
        />
      ) : (
        <Card className="flex h-[400px] items-center justify-center p-5 text-center text-[12.5px] text-muted-2">
          ยังไม่มีครีเอทีฟ — กดซิงค์ในหน้าตั้งค่า · No creatives yet — run a sync in Settings
        </Card>
      )}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  prefix,
  opts,
}: {
  value: T;
  onChange: (v: T) => void;
  prefix: string;
  opts: [T, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-input border border-[#dde1e7] bg-field-bg px-[10px] py-[7px] text-[12.5px] font-medium text-ink"
    >
      {opts.map(([v, label]) => (
        <option key={v} value={v}>
          {prefix}
          {label}
        </option>
      ))}
    </select>
  );
}
