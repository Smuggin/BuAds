"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { getOverview } from "@/lib/api";
import { useAppStore } from "@/store/AppProvider";
import { Icon } from "@/components/icons/Icon";
import type { DeltaTone, SummaryCard } from "@/data/types";

const TONE: Record<DeltaTone, string> = {
  pos: "text-success",
  neg: "text-danger",
  neutral: "text-[#6b7280]",
};

/**
 * KPI summary strip — sits under the top bar on every page (DESIGN §3). Reads the
 * live superset of cards from /api/overview (DB-computed) and shows only the ones
 * the user has picked (persisted in the store / localStorage via visibleKpiKeys).
 */
export function KpiSummaryStrip() {
  const [all, setAll] = useState<SummaryCard[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const range = useAppStore((s) => s.range);
  const customRange = useAppStore((s) => s.customRange);
  const visibleKeys = useAppStore((s) => s.visibleKpiKeys);
  const setVisibleKeys = useAppStore((s) => s.setVisibleKpiKeys);

  useEffect(() => {
    let alive = true;
    getOverview(accountFilter, range).then((d) => alive && setAll(d.summary));
    return () => {
      alive = false;
    };
  }, [accountFilter, range, customRange]);

  const byKey = useMemo(() => {
    const m = new Map<string, SummaryCard>();
    for (const c of all) if (c.key) m.set(c.key, c);
    return m;
  }, [all]);

  // Displayed cards follow the user's chosen order; unknown keys are skipped.
  const cards = visibleKeys.map((k) => byKey.get(k)).filter((c): c is SummaryCard => !!c);

  const toggle = (key: string) => {
    if (visibleKeys.includes(key)) {
      if (visibleKeys.length <= 1) return; // keep at least one card
      setVisibleKeys(visibleKeys.filter((k) => k !== key));
    } else {
      setVisibleKeys([...visibleKeys, key]);
    }
  };

  // Drag-to-reorder the shown cards (matches the Product-KPI pattern): the order
  // updates live on hover; visibleKeys drives both the popover and the strip.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const onDragOver = (e: DragEvent, overKey: string) => {
    e.preventDefault();
    if (!dragKey || dragKey === overKey) return;
    const from = visibleKeys.indexOf(dragKey);
    const to = visibleKeys.indexOf(overKey);
    if (from < 0 || to < 0) return;
    const next = [...visibleKeys];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setVisibleKeys(next);
  };

  const hiddenCards = all.filter((c) => c.key && !visibleKeys.includes(c.key));

  return (
    <section className="flex items-stretch gap-3">
      <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {cards.map((c) => (
          <div
            key={c.key ?? c.en}
            className="min-w-0 rounded-card border border-border bg-card px-[15px] py-[14px] shadow-card"
          >
            <div className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
              {c.en}
            </div>
            <div className="mb-2 text-[11.5px] text-faint-2">{c.th}</div>
            <div className="num whitespace-nowrap text-[21px] font-semibold tracking-[-0.03em]">
              {c.value}
            </div>
            {c.delta && (
              <div className="mt-[6px] flex items-center gap-[5px]">
                <span className={`num text-[12px] font-semibold ${TONE[c.tone]}`}>
                  {c.up ? "▲" : "▼"} {c.delta}
                </span>
                <span className="text-[10.5px] text-faint">vs prev</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* customize control — a card-styled tile at the end of the strip */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="เลือกตัวชี้วัด · Choose metrics"
          aria-expanded={pickerOpen}
          title="เลือกตัวชี้วัด · Choose metrics"
          className={`flex h-full w-[46px] items-center justify-center rounded-card border transition-colors duration-bg ${
            pickerOpen
              ? "border-ink bg-ink text-white"
              : "border-border bg-card text-muted shadow-card hover:text-ink"
          }`}
        >
          <Icon name="gear" size={16} />
        </button>

        {pickerOpen && (
          <>
            <button
              type="button"
              aria-label="ปิด"
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-[264px] overflow-hidden rounded-[12px] border border-[#e4e7ec] bg-card shadow-dropdown">
              <div className="border-b border-border-2 px-[13px] py-[10px] text-[12px] font-semibold">
                เลือกตัวชี้วัด · Choose metrics
              </div>
              <div className="max-h-[360px] overflow-y-auto py-1">
                {/* shown — drag the ⠿ handle to reorder how they appear on screen */}
                <div className="px-[13px] pb-[3px] pt-[5px] text-[10px] font-semibold uppercase tracking-[0.04em] text-faint">
                  แสดงอยู่ · Shown · ลากเพื่อจัดลำดับ
                </div>
                {cards.map((c) => (
                  <div
                    key={c.key}
                    onDragOver={(e) => onDragOver(e, c.key!)}
                    onDrop={() => setDragKey(null)}
                    className="flex items-center gap-[8px] px-[10px] py-[6px] transition-opacity hover:bg-field-bg"
                    style={{ opacity: dragKey === c.key ? 0.4 : 1 }}
                  >
                    <span
                      draggable
                      onDragStart={() => setDragKey(c.key!)}
                      onDragEnd={() => setDragKey(null)}
                      title="ลากเพื่อจัดลำดับ · Drag to reorder"
                      aria-label="ลากเพื่อจัดลำดับ · Drag to reorder"
                      className="flex h-6 w-4 flex-shrink-0 cursor-grab items-center justify-center text-[15px] leading-none text-faint hover:text-ink active:cursor-grabbing"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(c.key!)}
                      className="flex min-w-0 flex-1 items-center gap-[10px] text-left"
                    >
                      <span className="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-[4px] border border-accent bg-accent text-white">
                        <Icon name="check" size={11} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-ink">{c.en}</span>
                        <span className="block text-[11px] text-faint-2">{c.th}</span>
                      </span>
                      <span className="num flex-shrink-0 text-[11px] text-muted">{c.value}</span>
                    </button>
                  </div>
                ))}

                {hiddenCards.length > 0 && (
                  <>
                    <div className="mt-[3px] border-t border-border-2 px-[13px] pb-[3px] pt-[7px] text-[10px] font-semibold uppercase tracking-[0.04em] text-faint">
                      ซ่อนอยู่ · Hidden
                    </div>
                    {hiddenCards.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggle(c.key!)}
                        className="flex w-full items-center gap-[8px] px-[10px] py-[6px] text-left hover:bg-field-bg"
                      >
                        <span className="w-4 flex-shrink-0" />
                        <span className="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-[4px] border border-[#cfd4dc] bg-card" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-medium text-ink">{c.en}</span>
                          <span className="block text-[11px] text-faint-2">{c.th}</span>
                        </span>
                        <span className="num flex-shrink-0 text-[11px] text-muted">{c.value}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
