"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCampaigns, getCreatives, getLogs, getProducts } from "@/lib/api";
import { accountMetaFor, firstSortDir } from "@/lib/constants";
import { buildCampaignGroups, type CampSortKey } from "@/lib/campaigns";
import { effAutoClose, effBudget, effThresholds } from "@/lib/resolvers";
import { evalCampaign, resolveCampaignState } from "@/lib/kpi";
import { useAppStore } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { CampaignGroupTable } from "./CampaignGroupTable";
import { BudgetModal } from "./BudgetModal";
import { HistoryModal } from "./HistoryModal";
import { CampaignDetail } from "./CampaignDetail";
import type { Campaign, Creative, LogEntry, Product } from "@/data/types";

const GROUP_BY_OPTS = [
  ["product", "จัดกลุ่มตามสินค้า · by product"],
  ["account", "จัดกลุ่มตามบัญชี · by ad account"],
  ["none", "ทุกแคมเปญ · no grouping"],
] as const;
const GROUP_SORT_OPTS = [
  ["perf", "ประสิทธิภาพกลุ่ม · performance"],
  ["name", "ชื่อกลุ่ม · name"],
] as const;

export function CampaignsView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  // store
  const groupBy = useAppStore((s) => s.groupBy);
  const groupSort = useAppStore((s) => s.groupSort);
  const groupDir = useAppStore((s) => s.groupDir);
  const campSort = useAppStore((s) => s.campSort);
  const campDir = useAppStore((s) => s.campDir);
  const prodThr = useAppStore((s) => s.prodThr);
  const autoOverride = useAppStore((s) => s.autoOverride);
  const budgetOverride = useAppStore((s) => s.budgetOverride);
  const campOverride = useAppStore((s) => s.campOverride);
  const campDetail = useAppStore((s) => s.campDetail);
  const budgetModal = useAppStore((s) => s.budgetModal);
  const historyModal = useAppStore((s) => s.historyModal);
  const creativeOpen = useAppStore((s) => s.creativeOpen);

  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const setGroupSort = useAppStore((s) => s.setGroupSort);
  const toggleGroupDir = useAppStore((s) => s.toggleGroupDir);
  const setCampSort = useAppStore((s) => s.setCampSort);
  const toggleCamp = useAppStore((s) => s.toggleCamp);
  const openBudgetModal = useAppStore((s) => s.openBudgetModal);
  const setBudgetDraft = useAppStore((s) => s.setBudgetDraft);
  const setBudgetOverride = useAppStore((s) => s.setBudgetOverride);
  const closeBudgetModal = useAppStore((s) => s.closeBudgetModal);
  const openHistory = useAppStore((s) => s.openHistory);
  const closeHistory = useAppStore((s) => s.closeHistory);
  const openCampDetail = useAppStore((s) => s.openCampDetail);
  const closeCampDetail = useAppStore((s) => s.closeCampDetail);
  const toggleCreativeOpen = useAppStore((s) => s.toggleCreativeOpen);

  useEffect(() => {
    let alive = true;
    Promise.all([getProducts(), getCampaigns(), getCreatives(), getLogs()]).then(
      ([p, c, cr, l]) => {
        if (!alive) return;
        setProducts(p);
        setCampaigns(c);
        setCreatives(cr);
        setLogs(l);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!products || !campaigns || !creatives || !logs) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <Card className="h-[88px]" />
        <Card className="h-[52px]" />
        <Card className="h-[280px]" />
      </div>
    );
  }

  const productBySku = (sku: string) => products.find((p) => p.sku === sku)!;
  const campaignById = (id: string) => campaigns.find((c) => c.id === id)!;
  const resolveState = (c: Campaign) => {
    const p = productBySku(c.sku);
    const thr = effThresholds(p, prodThr);
    const ev = evalCampaign(c.metrics, thr);
    return resolveCampaignState(ev.verdict, effAutoClose(p, autoOverride), campOverride[c.id]);
  };

  const { groups, summary } = buildCampaignGroups({
    campaigns,
    products,
    groupBy,
    groupSort,
    groupDir,
    campSort,
    campDir,
    prodThr,
    autoOverride,
    budgetOverride,
    campOverride,
  });

  const onSort = (key: CampSortKey) => setCampSort(key, firstSortDir(key));

  // overlays (can open from list or detail)
  const overlays = (
    <>
      {budgetModal &&
        (() => {
          const c = campaignById(budgetModal.id);
          const p = productBySku(c.sku);
          return (
            <BudgetModal
              campaign={c}
              product={p}
              accountTh={accountMetaFor(c.account).th}
              current={effBudget(c, budgetOverride)}
              draft={budgetModal.draft}
              state={resolveState(c)}
              onSetDraft={setBudgetDraft}
              onConfirm={() => {
                setBudgetOverride(c.id, budgetModal.draft);
                closeBudgetModal();
              }}
              onClose={closeBudgetModal}
            />
          );
        })()}
      {historyModal &&
        (() => {
          const c = campaignById(historyModal);
          const p = productBySku(c.sku);
          return (
            <HistoryModal
              campaign={c}
              product={p}
              accountTh={accountMetaFor(c.account).th}
              entries={logs.filter((e) => e.campaignId === historyModal)}
              onClose={closeHistory}
            />
          );
        })()}
    </>
  );

  // ---- in-page detail (state swap, not a route) ----
  if (campDetail) {
    const c = campaignById(campDetail);
    const p = productBySku(c.sku);
    return (
      <>
        <CampaignDetail
          campaign={c}
          product={p}
          thresholds={effThresholds(p, prodThr)}
          state={resolveState(c)}
          creatives={creatives}
          creativeOpen={creativeOpen}
          onToggleCreative={toggleCreativeOpen}
          onClose={closeCampDetail}
          onBudget={() => openBudgetModal(c.id, effBudget(c, budgetOverride))}
        />
        {overlays}
      </>
    );
  }

  // ---- list ----
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-[18px] rounded-card bg-ink px-[22px] py-[17px] text-white">
        <div className="min-w-[240px]">
          <div className="text-[15px] font-semibold">แคมเปญทั้งหมด · Judged by product KPI</div>
          <div className="text-[12px] text-muted-2">
            เทียบทุกแคมเปญกับเกณฑ์ KPI ของสินค้านั้น · ★ มาร์คตัวที่ทำได้ดี · ⏸ ปิดตัวที่เกินเกณฑ์อัตโนมัติ
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <Chip bg="rgba(31,138,91,.2)" color="#5fd49b">★ {summary.marked} น่าสนใจ</Chip>
          <Chip bg="rgba(150,156,166,.22)" color="#c4c9d1">● {summary.running} กำลังรัน</Chip>
          <Chip bg="rgba(214,69,61,.2)" color="#f0938c">⏸ {summary.closed} ปิดแล้ว</Chip>
          <Link
            href="/product-kpi"
            className="rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
          >
            ตั้งเกณฑ์ KPI →
          </Link>
        </div>
      </section>

      {/* controls */}
      <Card className="flex flex-wrap items-center gap-[18px] px-4 py-3">
        <div className="flex items-center gap-[9px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">มุมมอง</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
            className="rounded-input border border-[#dde1e7] bg-field-bg px-[10px] py-[7px] text-[12.5px] font-medium text-ink"
          >
            {GROUP_BY_OPTS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        {groupBy !== "none" && (
          <>
            <div className="h-6 w-px bg-[#e4e7ec]" />
            <div className="flex items-center gap-[7px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">เรียงกลุ่ม</span>
              <select
                value={groupSort}
                onChange={(e) => setGroupSort(e.target.value as typeof groupSort)}
                className="rounded-input border border-[#dde1e7] bg-field-bg px-[10px] py-[7px] text-[12.5px] font-medium text-ink"
              >
                {GROUP_SORT_OPTS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={toggleGroupDir}
                className="num h-8 w-8 rounded-input border border-[#dde1e7] bg-card text-[14px] text-ink"
              >
                {groupDir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-faint">คลิกหัวคอลัมน์เพื่อเรียงแคมเปญในกลุ่ม</span>
      </Card>

      {groups.map((g) => (
        <CampaignGroupTable
          key={g.key}
          group={g}
          campSort={campSort}
          campDir={campDir}
          onSort={onSort}
          onOpenDetail={openCampDetail}
          onHistory={openHistory}
          onBudget={(id) => openBudgetModal(id, effBudget(campaignById(id), budgetOverride))}
          onToggle={toggleCamp}
        />
      ))}
      {overlays}
    </div>
  );
}

function Chip({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-pill px-[11px] py-[6px] text-[12px] font-semibold"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
