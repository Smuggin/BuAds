"use client";

import { useEffect, useState } from "react";
import { getOverview, type OverviewData } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { DailySpendCard } from "./DailySpendCard";
import { SpendShareCard } from "./SpendShareCard";
import { AccountsTable } from "./AccountsTable";

export function OverviewView() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    let alive = true;
    getOverview().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <OverviewSkeleton />;

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
        <DailySpendCard daily={data.daily} />
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
