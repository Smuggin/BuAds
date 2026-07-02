"use client";

interface Props {
  count: number; // number of campaigns with staged edits
  onSave: () => void;
  onDiscard: () => void;
}

/** Sticky action bar that appears once the user has staged on/off or budget edits. */
export function SaveChangesBar({ count, onSave, onDiscard }: Props) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-30 flex items-center justify-between gap-4 rounded-card bg-ink px-[20px] py-[13px] text-white shadow-modal">
      <div className="flex items-center gap-[10px]">
        <span className="num rounded-pill bg-[rgba(59,111,224,.25)] px-[10px] py-[3px] text-[12px] font-bold text-[#9db8f1]">
          {count}
        </span>
        <span className="text-[13px] font-medium">
          การเปลี่ยนแปลงที่ยังไม่บันทึก · {count} unsaved change{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex items-center gap-[9px]">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-input border border-[rgba(255,255,255,.22)] bg-transparent px-[14px] py-[8px] text-[12.5px] font-medium text-white/85 hover:bg-white/10"
        >
          ยกเลิก · Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-input bg-accent px-[16px] py-[8px] text-[12.5px] font-semibold text-white hover:brightness-110"
        >
          บันทึกการเปลี่ยนแปลง · Save
        </button>
      </div>
    </div>
  );
}
