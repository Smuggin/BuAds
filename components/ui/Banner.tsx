import type { ReactNode } from "react";

/** Dark intro banner (#16181d) used atop Campaigns, Product KPI, Automation, etc. */
export function Banner({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-[18px] rounded-card bg-ink px-[22px] py-[17px] text-white">
      <div className="min-w-[240px]">
        <div className="text-[15px] font-semibold">{title}</div>
        {subtitle && <div className="mt-[2px] text-[12px] text-muted-2">{subtitle}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-[9px]">{children}</div>}
    </section>
  );
}
