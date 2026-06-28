import type { ReactNode } from "react";

/**
 * Status chip — `background = color@~9% alpha; color = color` (DESIGN §2).
 * The `18` hex suffix ≈ 9% alpha. Pass `flatBg` for neutral chips that don't
 * follow the tinted-alpha pattern (e.g. Paused grey).
 */
export function StatusChip({
  color,
  flatBg,
  dot = false,
  icon,
  children,
}: {
  color: string;
  flatBg?: string;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11.5px] font-medium"
      style={{ background: flatBg ?? color + "18", color }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {icon}
      {children}
    </span>
  );
}
