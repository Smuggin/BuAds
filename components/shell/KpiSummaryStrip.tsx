"use client";

import { useEffect, useState } from "react";
import { getOverview } from "@/lib/api";
import type { DeltaTone, SummaryCard } from "@/data/types";

const TONE: Record<DeltaTone, string> = {
  pos: "text-success",
  neg: "text-danger",
  neutral: "text-[#6b7280]",
};

/**
 * 6-card KPI summary strip — sits under the top bar on every page (DESIGN §3).
 * Reads live totals from /api/overview (DB-computed).
 */
export function KpiSummaryStrip() {
  const [cards, setCards] = useState<SummaryCard[]>([]);
  useEffect(() => {
    let alive = true;
    getOverview().then((d) => alive && setCards(d.summary));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      {cards.map((c) => (
        <div
          key={c.en}
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
    </section>
  );
}
