"use client";

import { useEffect, useRef, useState } from "react";

export interface FilterOption {
  value: string;
  label: string; // bilingual "ไทย · English"
  icon?: string;
  color?: string; // dot/icon tint
}

/**
 * Compact multi-select dropdown for the Campaigns filter bar.
 * Trigger mirrors the native-select styling; the panel is a checkbox list that
 * closes on outside-click / Esc. Selection is controlled by the parent.
 */
export function FilterMenu({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string; // bilingual dimension label
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = selected.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-[7px] rounded-input border px-[10px] py-[7px] text-[12.5px] font-medium transition-colors duration-bg ${
          count
            ? "border-accent/50 bg-accent/[0.06] text-ink"
            : "border-[#dde1e7] bg-field-bg text-ink hover:border-[#c9cfd8]"
        }`}
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="num inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-accent px-[5px] text-[10.5px] font-semibold text-white">
            {count}
          </span>
        )}
        <span className="text-[10px] text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[220px] overflow-hidden rounded-card border border-border bg-card py-1 shadow-dropdown"
        >
          {options.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => onToggle(opt.value)}
                className="flex w-full items-center gap-[10px] px-3 py-[7px] text-left text-[12.5px] text-ink hover:bg-border-3"
              >
                <span
                  className={`flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[4px] border text-[10px] text-white ${
                    on ? "border-accent bg-accent" : "border-[#cdd2da] bg-white"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                {opt.icon && (
                  <span className="w-[14px] text-center" style={{ color: opt.color }}>
                    {opt.icon}
                  </span>
                )}
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
          {count > 0 && (
            <>
              <div className="my-1 h-px bg-border-2" />
              <button
                type="button"
                onClick={onClear}
                className="w-full px-3 py-[6px] text-left text-[11.5px] font-medium text-muted hover:text-ink"
              >
                ล้าง · Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
