"use client";

import { useEffect, useState } from "react";
import { getCampaigns, getLogs, getProducts } from "@/lib/api";
import { LOG_ACTOR_META, LOG_TYPE_META } from "@/lib/constants";
import { LOG_DAYS } from "@/data/logs";
import { useAppStore } from "@/store/AppProvider";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Card } from "@/components/ui/Card";
import type { Campaign, LogEntry, Product } from "@/data/types";

const FILTERS = [
  ["all", "ทั้งหมด · All"],
  ["manual", "ทีมงาน · Manual"],
  ["auto", "ระบบอัตโนมัติ · Automation"],
] as const;

export function ActivityView() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const logActor = useAppStore((s) => s.logActor);
  const setLogActor = useAppStore((s) => s.setLogActor);

  useEffect(() => {
    let alive = true;
    Promise.all([getLogs(), getCampaigns(), getProducts()]).then(([l, c, p]) => {
      if (!alive) return;
      setLogs(l);
      setCampaigns(c);
      setProducts(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!logs || !campaigns || !products) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <Card className="h-[80px]" />
        <Card className="h-[300px]" />
      </div>
    );
  }

  const counts = {
    total: logs.length,
    manual: logs.filter((e) => e.actor === "manual").length,
    auto: logs.filter((e) => e.actor === "auto").length,
  };
  const filtered = logs.filter((e) => logActor === "all" || e.actor === logActor);
  const subjectOf = (e: LogEntry) =>
    e.campaignId
      ? (campaigns.find((c) => c.id === e.campaignId)?.name ?? "")
      : `${products.find((p) => p.sku === e.sku)?.th ?? ""} · เกณฑ์สินค้า`;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-[18px] rounded-card bg-ink px-[22px] py-[17px] text-white">
        <div>
          <div className="text-[15px] font-semibold">ประวัติการทำงาน · Activity log</div>
          <div className="num mt-[2px] text-[12px] text-muted-2">
            ทั้งหมด {counts.total} · ทีมงาน {counts.manual} · อัตโนมัติ {counts.auto}
          </div>
        </div>
        <select
          value={logActor}
          onChange={(e) => setLogActor(e.target.value as typeof logActor)}
          className="rounded-input border border-[#3a3f47] bg-[#23262d] px-[12px] py-2 text-[12.5px] font-medium text-white"
        >
          {FILTERS.map(([v, label]) => (
            <option key={v} value={v} className="text-ink">
              {label}
            </option>
          ))}
        </select>
      </section>

      {LOG_DAYS.map(([key, label]) => {
        const entries = filtered.filter((e) => e.day === key);
        if (entries.length === 0) return null;
        return (
          <div key={key} className="flex flex-col gap-2">
            <div className="px-1 text-[12px] font-semibold text-muted">{label}</div>
            <Card className="overflow-hidden">
              {entries.map((e) => {
                const tm = LOG_TYPE_META[e.type];
                const am = LOG_ACTOR_META[e.actor];
                return (
                  <div key={e.id} className="flex items-start gap-[13px] border-t border-border-3 px-[18px] py-[14px] first:border-t-0">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control"
                      style={{ background: tm.color + "18", color: tm.color }}
                    >
                      <Icon name={tm.icon as IconName} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{e.title}</span>
                        <span className="text-[11.5px] text-muted-2">· {subjectOf(e)}</span>
                      </div>
                      <div className="mt-[3px] text-[12px] text-muted">{e.detail}</div>
                      {e.actor === "auto" && e.ruleName && (
                        <div className="mt-1 text-[11px] text-violet">ทำงานโดยกฎ: {e.ruleName}</div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-[5px]">
                      <span className="num text-[11.5px] text-faint">{e.time}</span>
                      <span
                        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill px-2 py-[3px] text-[10.5px] font-semibold"
                        style={{ background: am.bg, color: am.color }}
                      >
                        <span
                          className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[7.5px] font-bold text-white"
                          style={{ background: am.color }}
                        >
                          {e.actor === "auto" ? <Icon name="bolt" size={10} /> : "avatar" in am ? am.avatar : "PJ"}
                        </span>
                        {am.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
