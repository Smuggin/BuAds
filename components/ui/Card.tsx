import type { ReactNode } from "react";

/** White card: 1px border, radius 12, faint shadow (DESIGN §2). */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-card border border-border bg-card shadow-card ${className}`}>
      {children}
    </div>
  );
}
