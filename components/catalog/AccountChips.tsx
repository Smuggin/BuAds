import { ACCOUNT_META } from "@/lib/constants";
import type { AccountKey } from "@/data/types";

/** Multi-select account chips (one product → many accounts). */
export function AccountChips({
  selected,
  onToggle,
}: {
  selected: AccountKey[];
  onToggle: (k: AccountKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(ACCOUNT_META) as AccountKey[]).map((k) => {
        const on = selected.includes(k);
        const m = ACCOUNT_META[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            aria-pressed={on}
            className="inline-flex items-center gap-[6px] rounded-input px-[11px] py-[7px] text-[12px] font-semibold"
            style={{
              border: `1px solid ${on ? m.color : "#dde1e7"}`,
              background: on ? m.color : "#fff",
              color: on ? "#fff" : "#5b6068",
            }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? "#fff" : "#cdd1d8" }} />
            {m.th}
          </button>
        );
      })}
    </div>
  );
}
