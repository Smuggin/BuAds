"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  applyCampaignChanges,
  assignCampaignProduct,
  getCampaigns,
  getCreatives,
  getLogs,
  getProducts,
  peekCampaigns,
  peekCreatives,
  peekLogs,
  peekProducts,
  runStatusSync,
  type CampaignChange,
  type CampaignChangeResult,
} from "@/lib/api";
import { accountMetaFor, firstSortDir } from "@/lib/constants";
import {
  buildCampaignGroups,
  hasActiveFilters,
  pinnedActionGroups,
  type CampFilters,
  type CampSortKey,
} from "@/lib/campaigns";
import {
  effBudget,
  effCloseMode,
  effScaleThresholds,
  effSkipMetrics,
  effThresholds,
} from "@/lib/resolvers";
import { evalCampaign, resolveCampaignState, verdictMeta } from "@/lib/kpi";
import { useAppStore } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { FilterMenu, type FilterOption } from "@/components/ui/FilterMenu";
import { CampaignGroupTable } from "./CampaignGroupTable";
import { AssignSkuModal } from "./AssignSkuModal";
import { BudgetModal } from "./BudgetModal";
import { SaveChangesBar } from "@/components/ui/SaveChangesBar";
import { ConfirmChangesModal, type PendingChange } from "./ConfirmChangesModal";
import { HistoryModal } from "./HistoryModal";
import { CampaignDetail } from "./CampaignDetail";
import type { Campaign, Creative, LogEntry, Product } from "@/data/types";

const GROUP_BY_OPTS = [
  ["product", "จัดกลุ่มตามสินค้า · by product"],
  ["account", "จัดกลุ่มตามบัญชี · by ad account"],
  ["status", "จัดกลุ่มตามสถานะ · by status"],
  ["none", "ทุกแคมเปญ · no grouping"],
] as const;
const GROUP_SORT_OPTS = [
  ["perf", "ประสิทธิภาพกลุ่ม · performance"],
  ["name", "ชื่อกลุ่ม · name"],
] as const;

// Filter dimension option lists (bilingual labels; icons/colors from verdictMeta).
const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "scale", label: "ควรสเกล · Should scale" },
  { value: "interesting", label: "น่าสนใจ · Interesting" },
  { value: "running", label: "กำลังรัน · Running" },
  { value: "breach", label: "ควรปิด · Should close" },
];
const STATUS_FILTER_OPTS: FilterOption[] = STATUS_OPTS.map((o) => {
  const m = verdictMeta(o.value as "scale" | "interesting" | "running" | "breach");
  return { ...o, icon: m.icon, color: m.color };
});
const ONOFF_FILTER_OPTS: FilterOption[] = [
  { value: "on", label: "เปิด · On", icon: "●", color: "#1f8a5b" },
  { value: "off", label: "ปิด · Off", icon: "⏸", color: "#6b7280" },
];
const CLOSE_FILTER_OPTS: FilterOption[] = [
  { value: "OFF", label: "ปิด · Off" },
  { value: "SUGGEST", label: "แนะนำ · Suggest", color: "#c98a16" },
  { value: "AUTO", label: "อัตโนมัติ · Auto", color: "#1f8a5b" },
];

// Human labels for active-filter chips (value → bilingual).
const FILTER_VALUE_LABEL: Record<string, string> = {
  scale: "ควรสเกล · Scale",
  interesting: "น่าสนใจ · Interesting",
  running: "กำลังรัน · Running",
  breach: "ควรปิด · Should close",
  on: "เปิด · On",
  off: "ปิด · Off",
  OFF: "ปิดนโยบาย · Close: Off",
  SUGGEST: "แนะนำ · Suggest",
  AUTO: "อัตโนมัติ · Auto",
};

export function CampaignsView() {
  // Range first — the data states below seed from the (range-keyed) peek cache.
  const range = useAppStore((s) => s.range);
  const customRange = useAppStore((s) => s.customRange);

  // Paint the last payloads instantly (stale-while-revalidate); the effect below
  // always refetches. Skeleton only on a true first-ever load.
  const [products, setProducts] = useState<Product[] | null>(() => peekProducts());
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(() => peekCampaigns(range, customRange));
  const [creatives, setCreatives] = useState<Creative[] | null>(() => peekCreatives(range));
  const [logs, setLogs] = useState<LogEntry[] | null>(() => peekLogs());
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<CampaignChangeResult[] | null>(null);

  // store
  const groupBy = useAppStore((s) => s.groupBy);
  const groupSort = useAppStore((s) => s.groupSort);
  const groupDir = useAppStore((s) => s.groupDir);
  const campSort = useAppStore((s) => s.campSort);
  const campDir = useAppStore((s) => s.campDir);
  const campFilters = useAppStore((s) => s.campFilters);
  const prodThr = useAppStore((s) => s.prodThr);
  const prodScale = useAppStore((s) => s.prodScale);
  const closeOverride = useAppStore((s) => s.closeOverride);
  const skipOverride = useAppStore((s) => s.skipOverride);
  const budgetOverride = useAppStore((s) => s.budgetOverride);
  const campOverride = useAppStore((s) => s.campOverride);
  const campDetail = useAppStore((s) => s.campDetail);
  const budgetModal = useAppStore((s) => s.budgetModal);
  const saveChangesOpen = useAppStore((s) => s.saveChangesOpen);
  const assignModal = useAppStore((s) => s.assignModal);
  const historyModal = useAppStore((s) => s.historyModal);
  const creativeOpen = useAppStore((s) => s.creativeOpen);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const rangeSyncTick = useAppStore((s) => s.rangeSyncTick);

  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const setGroupSort = useAppStore((s) => s.setGroupSort);
  const toggleGroupDir = useAppStore((s) => s.toggleGroupDir);
  const setCampSort = useAppStore((s) => s.setCampSort);
  const toggleCampFilter = useAppStore((s) => s.toggleCampFilter);
  const setCampQuery = useAppStore((s) => s.setCampQuery);
  const clearCampFilters = useAppStore((s) => s.clearCampFilters);
  const toggleCamp = useAppStore((s) => s.toggleCamp);
  const openBudgetModal = useAppStore((s) => s.openBudgetModal);
  const setBudgetDraft = useAppStore((s) => s.setBudgetDraft);
  const setBudgetOverride = useAppStore((s) => s.setBudgetOverride);
  const closeBudgetModal = useAppStore((s) => s.closeBudgetModal);
  const openSaveChanges = useAppStore((s) => s.openSaveChanges);
  const closeSaveChanges = useAppStore((s) => s.closeSaveChanges);
  const discardCampaignChanges = useAppStore((s) => s.discardCampaignChanges);
  const clearCampaignOverrides = useAppStore((s) => s.clearCampaignOverrides);
  const openAssign = useAppStore((s) => s.openAssign);
  const setAssignDraft = useAppStore((s) => s.setAssignDraft);
  const closeAssign = useAppStore((s) => s.closeAssign);
  const openHistory = useAppStore((s) => s.openHistory);
  const closeHistory = useAppStore((s) => s.closeHistory);
  const openCampDetail = useAppStore((s) => s.openCampDetail);
  const closeCampDetail = useAppStore((s) => s.closeCampDetail);
  const toggleCreativeOpen = useAppStore((s) => s.toggleCreativeOpen);

  useEffect(() => {
    let alive = true;
    Promise.all([getProducts(), getCampaigns(range, customRange), getCreatives(range), getLogs()])
      .then(([p, c, cr, l]) => {
        if (!alive) return;
        setProducts(p);
        setCampaigns(c);
        setCreatives(cr);
        setLogs(l);
      })
      // a failed fetch must not leave an unhandled rejection (and a permanent
      // skeleton) — the cached paint stays up and the next tick retries
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [range, customRange, rangeSyncTick]);

  // Near-realtime on/off: refetch the (background-poller-refreshed) cache every 120s,
  // and pull a fresh status the moment the tab regains focus, so the toggles track
  // Meta Business Suite without a manual sync.
  useEffect(() => {
    const refetch = () => getCampaigns(range, customRange).then(setCampaigns).catch(() => {});
    const interval = setInterval(refetch, 120_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runStatusSync().then(refetch);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [range, customRange]);

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
  const isMapped = (c: Campaign) => products.some((p) => p.sku === c.sku);
  const loadCampaigns = () => getCampaigns(range, customRange).then(setCampaigns);
  // Clicking a campaign with no product attached can't open the (product-keyed)
  // detail — prompt to assign a product first.
  const handleOpenDetail = (id: string) => {
    const c = campaignById(id);
    if (isMapped(c)) openCampDetail(id);
    else openAssign(id, c.sku);
  };
  const resolveState = (c: Campaign) => {
    const p = productBySku(c.sku);
    const thr = effThresholds(p, prodThr);
    const ev = evalCampaign(
      c.metrics,
      thr,
      effSkipMetrics(p, skipOverride),
      effScaleThresholds(p, prodScale, prodThr),
    );
    return resolveCampaignState(ev.verdict, effCloseMode(p, closeOverride) !== "OFF", campOverride[c.id], c.status === "ACTIVE");
  };

  // global top-bar account scope
  const scopedCampaigns =
    accountFilter === "all" ? campaigns : campaigns.filter((c) => c.account === accountFilter);

  const { groups, summary, total, shown } = buildCampaignGroups({
    campaigns: scopedCampaigns,
    products,
    groupBy,
    groupSort,
    groupDir,
    campSort,
    campDir,
    prodThr,
    prodScale,
    closeOverride,
    skipOverride,
    budgetOverride,
    campOverride,
    filters: campFilters,
  });
  const pinned = pinnedActionGroups(groups, groupBy);
  const filtersActive = hasActiveFilters(campFilters);
  const productFilterOpts: FilterOption[] = products.map((p) => ({
    value: p.sku,
    label: `${p.th} · ${p.sku}`,
  }));
  // active-filter chips: flatten every selected value across dimensions
  const activeChips: { key: keyof CampFilters; value: string; label: string }[] = [
    ...campFilters.status.map((v) => ({ key: "status" as const, value: v, label: FILTER_VALUE_LABEL[v] })),
    ...campFilters.onOff.map((v) => ({ key: "onOff" as const, value: v, label: FILTER_VALUE_LABEL[v] })),
    ...campFilters.skus.map((v) => ({
      key: "skus" as const,
      value: v,
      label: products.find((p) => p.sku === v)?.th ?? v,
    })),
    ...campFilters.close.map((v) => ({ key: "close" as const, value: v, label: FILTER_VALUE_LABEL[v] })),
  ];

  const onSort = (key: CampSortKey) => setCampSort(key, firstSortDir(key));

  // Staged (unsaved) edits: an on/off flip and/or a budget change per campaign, diffed
  // against the real Meta values (c.status / c.budget). Drives the Save bar + review modal.
  const pendingChanges: PendingChange[] = campaigns
    .map((c): PendingChange | null => {
      const metaOn = c.status === "ACTIVE";
      const wantOn = campOverride[c.id];
      const statusChanged = wantOn !== undefined && wantOn !== metaOn;
      const wantBudget = budgetOverride[c.id];
      const budgetChanged = wantBudget !== undefined && wantBudget !== c.budget;
      if (!statusChanged && !budgetChanged) return null;
      return {
        id: c.id,
        name: c.name,
        accountTh: accountMetaFor(c.account).th,
        statusFrom: statusChanged ? metaOn : undefined,
        statusTo: statusChanged ? wantOn : undefined,
        budgetFrom: budgetChanged ? c.budget : undefined,
        budgetTo: budgetChanged ? wantBudget : undefined,
      };
    })
    .filter((x): x is PendingChange => x !== null);

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const changes: CampaignChange[] = pendingChanges.map((c) => ({
        id: c.id,
        status: c.statusTo === undefined ? undefined : c.statusTo ? "ACTIVE" : "PAUSED",
        dailyThb: c.budgetTo,
      }));
      const res = await applyCampaignChanges(changes);
      setSaveResults(res);
      // Clear only the edits that actually committed; failed ones stay staged for retry.
      clearCampaignOverrides(res.filter((r) => r.ok).map((r) => r.id));
      await loadCampaigns();
      if (res.every((r) => r.ok)) {
        closeSaveChanges();
        setSaveResults(null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ · save failed");
    } finally {
      setSaving(false);
    }
  };
  const handleCloseSave = () => {
    closeSaveChanges();
    setSaveResults(null);
  };

  // overlays (can open from list or detail)
  const overlays = (
    <>
      {assignModal &&
        (() => {
          const c = campaignById(assignModal.campaignId);
          return (
            <AssignSkuModal
              campaign={c}
              products={products}
              draftSku={assignModal.draftSku}
              saving={assigning}
              onSetDraft={setAssignDraft}
              onConfirm={async () => {
                setAssigning(true);
                try {
                  await assignCampaignProduct(c.id, assignModal.draftSku || null);
                  await loadCampaigns();
                  closeAssign();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "จับคู่สินค้าไม่สำเร็จ");
                } finally {
                  setAssigning(false);
                }
              }}
              onClose={closeAssign}
            />
          );
        })()}
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
          scaleThresholds={effScaleThresholds(p, prodScale, prodThr)}
          skip={effSkipMetrics(p, skipOverride)}
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
            เทียบทุกแคมเปญกับเกณฑ์ KPI ของสินค้านั้น · ⤴ ตัวที่ถึงเป้าสเกล · ⚠ ตัวที่ควรปิด
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <Chip bg="rgba(31,138,91,.2)" color="#5fd49b">⤴ {summary.scale} ควรสเกล</Chip>
          <Chip bg="rgba(201,138,22,.2)" color="#e6b24d">★ {summary.marked} น่าสนใจ</Chip>
          <Chip bg="rgba(150,156,166,.22)" color="#c4c9d1">● {summary.running} กำลังรัน</Chip>
          <Chip bg="rgba(214,69,61,.2)" color="#f0938c">⚠ {summary.breach} ควรปิด</Chip>
          <Chip bg="rgba(150,156,166,.16)" color="#9aa0a8">⏸ {summary.closed} ปิดแล้ว</Chip>
          <Link
            href="/product-kpi"
            className="rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
          >
            ตั้งเกณฑ์ KPI →
          </Link>
        </div>
      </section>

      {/* controls */}
      <Card className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[10px]">
          {/* search */}
          <div className="relative">
            <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[12px] text-faint">
              ⌕
            </span>
            <input
              type="text"
              value={campFilters.query}
              onChange={(e) => setCampQuery(e.target.value)}
              placeholder="ค้นหาแคมเปญ · search"
              className="w-[190px] rounded-input border border-[#dde1e7] bg-field-bg py-[7px] pl-[26px] pr-[8px] text-[12.5px] text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>

          {/* filter dropdowns */}
          <FilterMenu
            label="สถานะ · Status"
            options={STATUS_FILTER_OPTS}
            selected={campFilters.status}
            onToggle={(v) => toggleCampFilter("status", v as CampFilters["status"][number])}
            onClear={() => campFilters.status.forEach((v) => toggleCampFilter("status", v))}
          />
          <FilterMenu
            label="เปิด/ปิด · On/Off"
            options={ONOFF_FILTER_OPTS}
            selected={campFilters.onOff}
            onToggle={(v) => toggleCampFilter("onOff", v as CampFilters["onOff"][number])}
            onClear={() => campFilters.onOff.forEach((v) => toggleCampFilter("onOff", v))}
          />
          <FilterMenu
            label="สินค้า · Product"
            options={productFilterOpts}
            selected={campFilters.skus}
            onToggle={(v) => toggleCampFilter("skus", v)}
            onClear={() => campFilters.skus.forEach((v) => toggleCampFilter("skus", v))}
          />
          <FilterMenu
            label="นโยบายปิด · Close policy"
            options={CLOSE_FILTER_OPTS}
            selected={campFilters.close}
            onToggle={(v) => toggleCampFilter("close", v as CampFilters["close"][number])}
            onClear={() => campFilters.close.forEach((v) => toggleCampFilter("close", v))}
          />

          <div className="h-6 w-px bg-[#e4e7ec]" />

          {/* grouping */}
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
          {groupBy !== "none" && groupBy !== "status" && (
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
          )}

          <div className="flex-1" />
          <span className="num text-[11.5px] text-muted">
            แสดง <span className="font-semibold text-ink">{shown}</span> จาก {total} แคมเปญ
          </span>
        </div>

        {/* active-filter row */}
        {filtersActive && (
          <div className="flex flex-wrap items-center gap-[7px] border-t border-border-2 pt-[10px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
              ตัวกรอง
            </span>
            {campFilters.query.trim() && (
              <FilterChip
                label={`“${campFilters.query.trim()}”`}
                onRemove={() => setCampQuery("")}
              />
            )}
            {activeChips.map((c) => (
              <FilterChip
                key={`${c.key}:${c.value}`}
                label={c.label}
                onRemove={() => toggleCampFilter(c.key as "status" | "onOff" | "skus" | "close", c.value as never)}
              />
            ))}
            <button
              type="button"
              onClick={clearCampFilters}
              className="ml-1 rounded-input px-[9px] py-[4px] text-[11.5px] font-medium text-accent hover:bg-accent/[0.08]"
            >
              ล้างทั้งหมด · Clear all
            </button>
          </div>
        )}
      </Card>

      {/* empty state — no campaigns match the active filters */}
      {shown === 0 && (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <div className="text-[28px] text-faint">⌕</div>
          <div className="text-[13.5px] font-semibold text-ink">
            ไม่พบแคมเปญตามตัวกรอง · No matching campaigns
          </div>
          <div className="text-[12px] text-muted-2">
            ลองปรับหรือล้างตัวกรอง · try adjusting or clearing the filters
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearCampFilters}
              className="mt-1 rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
            >
              ล้างทั้งหมด · Clear all
            </button>
          )}
        </Card>
      )}

      {/* pinned action groups (ควรสเกล / น่าสนใจ / ควรปิด / breaching) then the normal groups */}
      {[...pinned, ...groups].filter((g): g is NonNullable<typeof g> => !!g).map((g) => (
        <CampaignGroupTable
          key={g.key}
          group={g}
          campSort={campSort}
          campDir={campDir}
          onSort={onSort}
          onOpenDetail={handleOpenDetail}
          onHistory={openHistory}
          onBudget={(id) => openBudgetModal(id, effBudget(campaignById(id), budgetOverride))}
          onAssign={(id) => openAssign(id, campaignById(id).sku)}
          onToggle={toggleCamp}
        />
      ))}

      <SaveChangesBar
        count={pendingChanges.length}
        onSave={openSaveChanges}
        onDiscard={discardCampaignChanges}
      />

      {saveChangesOpen && (
        <ConfirmChangesModal
          changes={pendingChanges}
          saving={saving}
          results={saveResults}
          onConfirm={handleConfirmSave}
          onClose={handleCloseSave}
        />
      )}
      {overlays}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-[6px] rounded-pill border border-border bg-field-bg py-[4px] pl-[10px] pr-[6px] text-[11.5px] font-medium text-ink">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove filter"
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[11px] text-muted hover:bg-border-2 hover:text-ink"
      >
        ✕
      </button>
    </span>
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
