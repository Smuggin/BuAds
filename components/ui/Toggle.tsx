/** Pill toggle: white knob, #1f8a5b on / #cdd1d8 off, justify flips (DESIGN §2). */
export function Toggle({
  on,
  onClick,
  size = "sm",
  label,
}: {
  on: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
  label?: string;
}) {
  const d = size === "lg" ? { w: 38, h: 21, k: 17 } : { w: 34, h: 19, k: 15 };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="flex flex-shrink-0 items-center rounded-pill border-none p-[2px] transition-colors duration-bg"
      style={{
        width: d.w,
        height: d.h,
        background: on ? "#1f8a5b" : "#cdd1d8",
        justifyContent: on ? "flex-end" : "flex-start",
        cursor: "pointer",
      }}
    >
      <span
        className="rounded-full bg-white"
        style={{ width: d.k, height: d.k, boxShadow: "0 1px 2px rgba(0,0,0,.25)" }}
      />
    </button>
  );
}
