"use client";

import { useEffect, useState } from "react";
import { getAccounts, type AccountOption } from "@/lib/api";
import type { AccountKey } from "@/data/types";

/** Multi-select account chips (one product → many accounts), real synced accounts. */
export function AccountChips({
  selected,
  onToggle,
}: {
  selected: AccountKey[];
  onToggle: (k: AccountKey) => void;
}) {
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);

  useEffect(() => {
    let alive = true;
    getAccounts().then((a) => alive && setAccounts(a));
    return () => {
      alive = false;
    };
  }, []);

  if (!accounts) {
    return <div className="text-[12px] text-muted-2">กำลังโหลดบัญชี…</div>;
  }
  if (accounts.length === 0) {
    return <div className="text-[12px] text-muted-2">ยังไม่มีบัญชีที่ซิงค์ · ซิงค์จาก Settings</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((a) => {
        const on = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onToggle(a.id)}
            aria-pressed={on}
            title={a.id}
            className="inline-flex items-center gap-[6px] rounded-input px-[11px] py-[7px] text-[12px] font-semibold"
            style={{
              border: `1px solid ${on ? a.color : "#dde1e7"}`,
              background: on ? a.color : "#fff",
              color: on ? "#fff" : "#5b6068",
            }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#fff" : "#cdd1d8" }} />
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
