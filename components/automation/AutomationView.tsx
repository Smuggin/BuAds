"use client";

import { useEffect, useState } from "react";
import { getRules } from "@/lib/api";
import { effRuleOn } from "@/lib/resolvers";
import { useAppStore } from "@/store/AppProvider";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import type { Rule } from "@/data/types";

export function AutomationView() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const ruleOverride = useAppStore((s) => s.ruleOverride);
  const toggleRule = useAppStore((s) => s.toggleRule);

  useEffect(() => {
    let alive = true;
    getRules().then((r) => alive && setRules(r));
    return () => {
      alive = false;
    };
  }, []);

  if (!rules) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <Card className="h-[80px]" />
        <Card className="h-[76px]" />
        <Card className="h-[76px]" />
      </div>
    );
  }

  const activeCount = rules.filter((r) => effRuleOn(r, ruleOverride)).length;
  const totalRuns = rules.reduce((s, r) => s + r.runs, 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-[18px] rounded-card bg-ink px-[22px] py-[17px] text-white">
        <div>
          <div className="text-[15px] font-semibold">ระบบอัตโนมัติ · Automation rules</div>
          <div className="num mt-[2px] text-[12px] text-muted-2">
            {activeCount} กฎทำงานอยู่ · {totalRuns} ครั้งที่ทำงานรวม
          </div>
        </div>
        <button
          type="button"
          className="rounded-input bg-accent px-[14px] py-2 text-[12px] font-semibold text-white"
        >
          + สร้างกฎใหม่
        </button>
      </section>

      {rules.map((r) => {
        const on = effRuleOn(r, ruleOverride);
        return (
          <Card key={r.id}>
            <div
              className="flex items-center gap-[15px] px-[18px] py-4 transition-opacity duration-opacity"
              style={{ opacity: on ? 1 : 0.6 }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control"
                style={{ background: on ? r.tone + "18" : "#f0f1f3", color: on ? r.tone : "#aeb3bb" }}
              >
                <Icon name={r.type as IconName} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[10px]">
                  <span className="text-[14px] font-semibold text-ink">{r.name}</span>
                  <span className="text-[11px] text-muted-2">{r.scope}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                  <span className="rounded-[6px] bg-field-bg px-2 py-1 font-medium text-slate">
                    IF · {r.ifCondition}
                  </span>
                  <span className="text-muted-2">→</span>
                  <span
                    className="rounded-[6px] px-2 py-1 font-medium"
                    style={{ background: r.tone + "14", color: r.tone }}
                  >
                    THEN · {r.thenAction}
                  </span>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <span className="num text-[11px] text-muted-2">
                  {r.runs}× · {r.lastRun}
                </span>
                <Toggle on={on} size="lg" onClick={() => toggleRule(r.id, r.on)} label={r.name} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
