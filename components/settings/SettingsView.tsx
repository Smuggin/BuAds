"use client";

import { useEffect, useState } from "react";
import { getProducts, getSettings } from "@/lib/api";
import { allCategories, effProduct, isConnected } from "@/lib/resolvers";
import { DEFAULT_CATEGORIES } from "@/data/categories";
import { useAppStore } from "@/store/AppProvider";
import type { AccentKeyTheme } from "@/store/useAppStore";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/icons/Icon";
import type { AvailableAccount, ConnectionAccount, Product } from "@/data/types";

const STATUS = {
  active: { label: "เชื่อมต่อแล้ว", color: "#1f8a5b" },
  syncing: { label: "กำลังซิงค์", color: "#3b6fe0" },
  warning: { label: "ต้องต่ออายุสิทธิ์", color: "#c98a16" },
} as const;

const ACCENTS: { key: AccentKeyTheme; hex: string }[] = [
  { key: "blue", hex: "#3b6fe0" },
  { key: "violet", hex: "#6e56cf" },
  { key: "green", hex: "#1f8a5b" },
  { key: "ink", hex: "#16181d" },
];

interface SettingsData {
  connected: ConnectionAccount[];
  available: AvailableAccount[];
}

export function SettingsView() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);

  const connOverride = useAppStore((s) => s.connOverride);
  const syncMap = useAppStore((s) => s.syncMap);
  const connectAccount = useAppStore((s) => s.connectAccount);
  const disconnectAccount = useAppStore((s) => s.disconnectAccount);
  const resyncAccount = useAppStore((s) => s.resyncAccount);
  const customCats = useAppStore((s) => s.customCats);
  const customProducts = useAppStore((s) => s.customProducts);
  const prodEdits = useAppStore((s) => s.prodEdits);
  const newCat = useAppStore((s) => s.newCat);
  const setNewCat = useAppStore((s) => s.setNewCat);
  const addCategory = useAppStore((s) => s.addCategory);
  const removeCategory = useAppStore((s) => s.removeCategory);
  const accent = useAppStore((s) => s.accent);
  const setAccent = useAppStore((s) => s.setAccent);
  const colorByPerformance = useAppStore((s) => s.colorByPerformance);
  const toggleColorByPerformance = useAppStore((s) => s.toggleColorByPerformance);

  useEffect(() => {
    let alive = true;
    Promise.all([getSettings(), getProducts()]).then(([s, p]) => {
      if (!alive) return;
      setData(s);
      setProducts(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !products) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <Card className="h-[80px]" />
        <Card className="h-[360px]" />
      </div>
    );
  }

  type Unified = (ConnectionAccount | AvailableAccount) & { connected: boolean };
  const allAccounts: Unified[] = [
    ...data.connected.map((a) => ({ ...a, connected: true })),
    ...data.available.map((a) => ({ ...a, connected: false })),
  ];
  const connected = allAccounts.filter((a) => isConnected(a, connOverride)) as (ConnectionAccount & { connected: boolean })[];
  const available = allAccounts.filter((a) => !isConnected(a, connOverride));

  const totalSpend = connected.reduce((s, a) => s + (parseInt((a.spend ?? "0").replace(/[^0-9]/g, "")) || 0), 0);
  const totalProducts = connected.reduce((s, a) => s + (a.products ?? 0), 0);
  const syncing = connected.filter((a) => a.status === "syncing").length;
  const needAttention = connected.filter((a) => a.status === "warning").length;
  const healthOk = needAttention === 0;

  const cats = allCategories(DEFAULT_CATEGORIES, customCats);
  const catCount = (c: string) =>
    [...products, ...customProducts].filter((p) => effProduct(p, prodEdits).category.toLowerCase() === c.toLowerCase()).length;

  const av = (color: string) => ({
    background: color,
  });

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-ink px-[22px] py-[17px] text-white">
        <div className="text-[15px] font-semibold">ตั้งค่า & เชื่อมต่อ · Settings</div>
        <div className="num mt-[2px] text-[12px] text-muted-2">
          เชื่อมต่อแล้ว {connected.length} บัญชี · พร้อมเชื่อม {available.length} บัญชี
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* left */}
        <div className="flex flex-col gap-4">
          {available.length > 0 && (
            <Card className="p-[18px]">
              <div className="mb-3 text-section-title">บัญชีที่เชื่อมได้ · Connect account</div>
              <div className="flex flex-col gap-2">
                {available.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-[10px] border border-border-2 p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold text-white" style={av(a.color)}>
                      {a.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">{a.name}</div>
                      <div className="num text-[11px] text-muted-2">{a.platform}</div>
                    </div>
                    <button type="button" onClick={() => connectAccount(a.id)} className="rounded-input bg-accent px-3 py-[7px] text-[12px] font-semibold text-white">
                      + เชื่อมต่อ
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-[18px]">
            <div className="mb-3 text-section-title">บัญชีที่เชื่อมต่อ · Connected accounts</div>
            <div className="flex flex-col gap-2">
              {connected.map((a) => {
                const sm = STATUS[a.status];
                const sync = syncMap[a.id] ?? a.lastSync;
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border-2 p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold text-white" style={av(a.color)}>
                      {a.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{a.name}</span>
                        <span className="rounded-pill px-[10px] py-1 text-[11px] font-semibold" style={{ background: sm.color + "18", color: sm.color }}>
                          {sm.label}
                        </span>
                      </div>
                      <div className="num text-[11px] text-muted-2">
                        {a.platform} · {a.id}
                      </div>
                      <div className="num mt-1 text-[11px] text-muted-2">
                        {a.spend ?? "—"} · {a.products ?? 0} สินค้า · ซิงค์ {sync}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => resyncAccount(a.id)} aria-label="ซิงค์ใหม่" className="flex h-8 w-8 items-center justify-center rounded-input border border-[#dde1e7] text-slate">
                        <Icon name="refresh" size={14} />
                      </button>
                      <button type="button" onClick={() => disconnectAccount(a.id)} aria-label="ยกเลิกการเชื่อมต่อ" className="flex h-8 w-8 items-center justify-center rounded-input border border-[#f0d8d6] text-danger">
                        <Icon name="unlink" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* right sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-[88px]">
          <div className="rounded-[11px] border p-4" style={{ background: healthOk ? "#f0f8f4" : "#fbf6ec", borderColor: healthOk ? "#d4ecdf" : "#f0e2c4" }}>
            <div className="flex items-center gap-2">
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: healthOk ? "#1f8a5b" : "#c98a16" }} />
              <span className="text-[13px] font-semibold" style={{ color: healthOk ? "#1f8a5b" : "#9a6a12" }}>
                {healthOk ? "ทุกบัญชีทำงานปกติ" : `${needAttention} บัญชีต้องตรวจสอบ`}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-muted">
              {healthOk ? "ข้อมูลซิงค์อัตโนมัติทุก 15 นาที" : "มีบัญชีต้องต่ออายุสิทธิ์การเข้าถึง"}
            </div>
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <div className="text-[12px] font-semibold text-slate">ภาพรวมการเชื่อมต่อ</div>
            <Overview icon="wallet" label="งบที่ดูแล" value={"฿" + totalSpend.toLocaleString()} />
            <Overview icon="box" label="สินค้าที่เชื่อม" value={String(totalProducts)} />
            <Overview icon="refresh" label="กำลังซิงค์" value={String(syncing)} />
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <div className="text-[12px] font-semibold text-slate">แพลตฟอร์ม · Platforms</div>
            <Platform name="Meta Ads" sub="Facebook + Instagram" on />
            <Platform name="TikTok Ads" sub="TikTok for Business" soon />
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <div className="text-[12px] font-semibold text-slate">การแสดงผล · Display</div>
            <div>
              <div className="mb-2 text-[11px] text-muted-2">สีหลัก · Accent</div>
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAccent(a.key)}
                    aria-label={`accent ${a.key}`}
                    aria-pressed={accent === a.key}
                    className="h-7 w-7 rounded-full"
                    style={{ background: a.hex, outline: accent === a.key ? "2px solid #16181d" : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-2">ลงสีตามผลงาน (ROAS)</span>
              <Toggle on={colorByPerformance} onClick={toggleColorByPerformance} label="color by performance" />
            </div>
          </Card>

          <Card className="flex items-start gap-2 p-4">
            <span className="mt-[2px] text-slate"><Icon name="shield" size={16} /></span>
            <div className="text-[11.5px] leading-[1.5] text-muted">
              สิทธิ์เข้าถึงแบบอ่านอย่างเดียว · AdsHub ขอสิทธิ์อ่านข้อมูลโฆษณาเท่านั้น
            </div>
          </Card>
        </div>
      </div>

      {/* category manager */}
      <Card className="p-[18px]">
        <div className="mb-1 text-section-title">หมวดหมู่สินค้า · Categories</div>
        <div className="mb-3 text-[12px] text-muted">หมวดหมู่ที่เพิ่มจะปรากฏในฟอร์มคลังสินค้าทันที</div>
        <div className="mb-4 flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newCat.trim() && addCategory(newCat.trim())}
            placeholder="เพิ่มหมวดหมู่ใหม่…"
            className="flex-1 rounded-input border border-[#dde1e7] bg-card px-[10px] py-[9px] text-[13px] text-ink"
          />
          <button
            type="button"
            onClick={() => newCat.trim() && addCategory(newCat.trim())}
            disabled={!newCat.trim()}
            className="inline-flex items-center gap-[6px] rounded-input bg-ink px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ opacity: newCat.trim() ? 1 : 0.5 }}
          >
            <Icon name="plus" size={15} /> เพิ่ม
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => {
            const isDefault = DEFAULT_CATEGORIES.some((d) => d.toLowerCase() === c.toLowerCase());
            return (
              <span
                key={c}
                className="inline-flex items-center gap-2 rounded-[9px] border px-[11px] py-2 text-[12px]"
                style={{ borderColor: isDefault ? "#e9ebef" : "#dbe6fb", background: isDefault ? "#fafbfc" : "#f5f8ff" }}
              >
                <span className="font-medium text-ink">{c}</span>
                <span className="num text-[10.5px] text-muted-2">{catCount(c)} สินค้า</span>
                {!isDefault && (
                  <button type="button" onClick={() => removeCategory(c)} aria-label={`ลบ ${c}`} className="text-faint hover:text-danger">
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Overview({ icon, label, value }: { icon: "wallet" | "box" | "refresh"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-input bg-field-bg text-slate">
        <Icon name={icon} size={15} />
      </span>
      <span className="flex-1 text-[12px] text-ink-2">{label}</span>
      <span className="num text-[13px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function Platform({ name, sub, on, soon }: { name: string; sub: string; on?: boolean; soon?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ opacity: soon ? 0.72 : 1 }}>
      <span
        className="flex h-[34px] w-[34px] items-center justify-center rounded-control"
        style={{ background: soon ? "#f0f1f3" : "#3b6fe018", color: soon ? "#aeb3bb" : "#3b6fe0" }}
      >
        <Icon name="bolt" size={16} />
      </span>
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold text-ink">{name}</div>
        <div className="text-[10.5px] text-muted-2">{sub}</div>
      </div>
      {on ? (
        <span className="rounded-input border border-[#d4ecdf] bg-[#f0f8f4] px-3 py-[6px] text-[11.5px] font-semibold text-success">เชื่อมต่ออยู่</span>
      ) : (
        <span className="rounded-input border border-border bg-[#f7f8fa] px-3 py-[6px] text-[11.5px] font-semibold text-faint">เร็วๆ นี้</span>
      )}
    </div>
  );
}
