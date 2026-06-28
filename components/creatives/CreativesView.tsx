"use client";

import { useEffect, useState } from "react";
import { getCampaigns, getCreatives, getProducts } from "@/lib/api";
import { ACCOUNT_META, FORMAT_META } from "@/lib/constants";
import { filterCreatives, skusInAccount } from "@/lib/creatives";
import { fmtMoney, roasColor, round1 } from "@/lib/format";
import { useAppStore } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { CreativeDetail } from "./CreativeDetail";
import type { AccountKey, Campaign, Creative, Product } from "@/data/types";

export function CreativesView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [creatives, setCreatives] = useState<Creative[] | null>(null);

  const mediaAcc = useAppStore((s) => s.mediaAcc);
  const mediaProd = useAppStore((s) => s.mediaProd);
  const selectedCreative = useAppStore((s) => s.selectedCreative);
  const prodThr = useAppStore((s) => s.prodThr);
  const autoOverride = useAppStore((s) => s.autoOverride);
  const selectCreative = useAppStore((s) => s.selectCreative);
  const setMediaAcc = useAppStore((s) => s.setMediaAcc);
  const setMediaProd = useAppStore((s) => s.setMediaProd);

  useEffect(() => {
    let alive = true;
    Promise.all([getProducts(), getCampaigns(), getCreatives()]).then(([p, c, cr]) => {
      if (!alive) return;
      setProducts(p);
      setCampaigns(c);
      setCreatives(cr);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!products || !campaigns || !creatives) {
    return (
      <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-[312px_1fr]">
        <Card className="h-[400px]" />
        <Card className="h-[400px]" />
      </div>
    );
  }

  const list = filterCreatives(creatives, campaigns, mediaAcc, mediaProd);
  const selected =
    creatives.find((c) => c.id === selectedCreative) ?? list[0] ?? creatives[0];

  const onAcc = (v: AccountKey | "all") => {
    const valid = skusInAccount(creatives, campaigns, v);
    const prod = mediaProd !== "all" && !valid.has(mediaProd) ? "all" : mediaProd;
    const next = filterCreatives(creatives, campaigns, v, prod);
    const sel = next.some((c) => c.id === selectedCreative)
      ? selectedCreative
      : (next[0]?.id ?? selectedCreative);
    setMediaAcc(v, { prod, sel });
  };
  const onProd = (v: string) => {
    const next = filterCreatives(creatives, campaigns, mediaAcc, v);
    const sel = next.some((c) => c.id === selectedCreative)
      ? selectedCreative
      : (next[0]?.id ?? selectedCreative);
    setMediaProd(v, sel);
  };

  const accOpts: [AccountKey | "all", string][] = [
    ["all", "ทุกบัญชี · All accounts"],
    ...(Object.keys(ACCOUNT_META) as AccountKey[]).map(
      (k) => [k, ACCOUNT_META[k].th] as [AccountKey, string],
    ),
  ];
  const scopedSkus = skusInAccount(creatives, campaigns, mediaAcc);
  const prodOpts: [string, string][] = [
    ["all", "ทุกสินค้า · All products"],
    ...products.filter((p) => scopedSkus.has(p.sku)).map((p) => [p.sku, p.th] as [string, string]),
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[312px_1fr]">
      {/* left: filters + list */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border-2 p-3">
          <Select value={mediaAcc} onChange={(v) => onAcc(v as AccountKey | "all")} prefix="บัญชี: " opts={accOpts} />
          <Select value={mediaProd} onChange={onProd} prefix="สินค้า: " opts={prodOpts} />
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
              const on = cr.id === selected.id;
              return (
                <button
                  key={cr.id}
                  type="button"
                  onClick={() => selectCreative(cr.id)}
                  className={`flex w-full items-center gap-3 border-t border-border-3 px-3 py-3 text-left transition-colors duration-bg ${on ? "bg-[#f5f8ff]" : "hover:bg-field-bg"}`}
                >
                  <div
                    className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-control text-[17px] text-white"
                    style={{ background: fm.color }}
                  >
                    {fm.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{cr.name}</div>
                    <div className="num mt-1 flex items-center gap-[10px] text-[11.5px] text-muted">
                      <span style={{ color: roasColor(cr.roas) }}>{round1(cr.roas)}x</span>
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

      {/* right: detail */}
      <CreativeDetail
        creative={selected}
        products={products}
        campaigns={campaigns}
        prodThr={prodThr}
        autoOverride={autoOverride}
      />
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
