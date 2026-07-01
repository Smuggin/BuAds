"use client";

import { useEffect, useState } from "react";
import { getOverview, type OverviewData } from "@/lib/api";
import { useAppStore } from "@/store/AppProvider";
import { Card } from "@/components/ui/Card";
import { DailySpendCard } from "./DailySpendCard";
import { SpendShareCard } from "./SpendShareCard";
import { AccountsTable } from "./AccountsTable";

export function OverviewView() {
  const [data, setData] = useState<OverviewData | null>(null);
  const accountFilter = useAppStore((s) => s.accountFilter);
  const range = useAppStore((s) => s.range);
  const customRange = useAppStore((s) => s.customRange);

  useEffect(() => {
    let alive = true;
    getOverview(accountFilter, range).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [accountFilter, range, customRange]);

  if (!data) return <OverviewSkeleton />;

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
        <DailySpendCard series={data.dailyByAccount} dates={data.dailyDates} />
        <SpendShareCard accounts={data.accounts} />
      </section>
      <AccountsTable accounts={data.accounts} />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-[18px]">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
        <Card className="h-[300px]" />
        <Card className="h-[300px]" />
      </section>
      <Card className="h-[320px]" />
    </div>
  );
}
