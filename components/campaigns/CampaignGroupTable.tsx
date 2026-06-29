import { CAMPAIGN_METRIC_DEFS, type CampaignGroup, type CampSortKey, type SortDir } from "@/lib/campaigns";
import { dirSymbol, fmtMetric, fmtMoney } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toggle } from "@/components/ui/Toggle";

interface Props {
  group: CampaignGroup;
  campSort: CampSortKey;
  campDir: SortDir;
  onSort: (key: CampSortKey) => void;
  onOpenDetail: (id: string) => void;
  onHistory: (id: string) => void;
  onBudget: (id: string) => void;
  onAssign: (id: string) => void;
  onToggle: (id: string, defaultOn: boolean) => void;
}

export function CampaignGroupTable({
  group,
  campSort,
  campDir,
  onSort,
  onOpenDetail,
  onHistory,
  onBudget,
  onAssign,
  onToggle,
}: Props) {
  const arrow = (key: CampSortKey) =>
    campSort === key ? (campDir === "asc" ? "↑" : "↓") : "⇅";
  const active = (key: CampSortKey) => campSort === key;

  return (
    <Card className="overflow-hidden">
      {/* group header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-2 px-[18px] py-[14px]">
        <div className="flex items-center gap-[11px]">
          <div
            className="num flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-input text-[10px] font-semibold text-white"
            style={{ background: group.color }}
          >
            {group.initials}
          </div>
          <div className="leading-[1.25]">
            <div className="text-[14px] font-semibold text-ink">{group.title}</div>
            <div className="text-[11.5px] text-muted-2">{group.subtitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="num text-[11.5px] text-muted">
            ★ {group.marked} · ⏸ {group.closed}
          </span>
          {group.hasAuto && (
            <span
              className="rounded-pill px-[10px] py-1 text-[11px] font-semibold"
              style={{
                background: group.autoOn ? "#e7f5ee" : "#f0f1f3",
                color: group.autoOn ? "#1f8a5b" : "#838992",
              }}
            >
              {group.autoOn ? "ปิดอัตโนมัติ · เปิด" : "ปิดอัตโนมัติ · ปิด"}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-field-bg text-[10.5px] tracking-[0.02em]">
              <Th onClick={() => onSort("name")} active={active("name")} align="left" pad="px-[18px]">
                แคมเปญ <Arrow on={active("name")}>{arrow("name")}</Arrow>
              </Th>
              {CAMPAIGN_METRIC_DEFS.map((m) => (
                <Th key={m.key} onClick={() => onSort(m.key)} active={active(m.key)}>
                  {m.short} <Arrow on={active(m.key)}>{arrow(m.key)}</Arrow>
                  <br />
                  <span className="num font-medium text-[#b7bcc4]">
                    {group.thresholds
                      ? `${dirSymbol(m.dir)}${fmtMetric(m.key, group.thresholds[m.key])}`
                      : ""}
                  </span>
                </Th>
              ))}
              <Th onClick={() => onSort("budget")} active={active("budget")}>
                งบ/วัน <Arrow on={active("budget")}>{arrow("budget")}</Arrow>
                <br />
                <span className="font-medium text-[#b7bcc4]">Budget</span>
              </Th>
              <Th onClick={() => onSort("status")} active={active("status")} align="left">
                สถานะ <Arrow on={active("status")}>{arrow("status")}</Arrow>
              </Th>
              <Th onClick={() => onSort("open")} active={active("open")}>
                เปิด/ปิด <Arrow on={active("open")}>{arrow("open")}</Arrow>
              </Th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => {
              const ctx =
                group.kind === "account"
                  ? r.prodTh
                  : group.kind === "none"
                    ? `${r.prodTh} · ${r.accTh}`
                    : r.accTh;
              const rowBg =
                r.statusRank === 2
                  ? "rgba(31,138,91,.05)"
                  : r.state.on
                    ? "#fff"
                    : "#fcf4f3";
              return (
                <tr
                  key={r.campaign.id}
                  style={{ background: rowBg, opacity: r.state.on ? 1 : 0.7 }}
                  className="transition-opacity duration-opacity"
                >
                  <td className="border-t border-border-2 px-[18px] py-3">
                    <div className="flex items-center gap-[6px]">
                      <span style={{ color: r.state.statusColor }}>{r.state.statusIcon}</span>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(r.campaign.id)}
                        title="ดูรายละเอียดแคมเปญ"
                        className="border-none bg-transparent p-0 text-left text-[13px] font-semibold text-ink hover:text-accent hover:underline"
                      >
                        {r.campaign.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onHistory(r.campaign.id)}
                        title="ประวัติการทำงานของแคมเปญนี้"
                        className="flex-shrink-0 rounded-[6px] px-1 py-[2px] text-[13px] leading-none text-faint-2 hover:bg-[#eef1f6] hover:text-accent"
                      >
                        ◷
                      </button>
                      <button
                        type="button"
                        onClick={() => onAssign(r.campaign.id)}
                        title="จับคู่สินค้า"
                        className={
                          r.unmapped
                            ? "flex-shrink-0 rounded-[6px] bg-[#eef1f6] px-2 py-[2px] text-[10.5px] font-semibold text-accent hover:bg-[#e3e8f2]"
                            : "flex-shrink-0 rounded-[6px] px-1 py-[2px] text-[13px] leading-none text-faint-2 hover:bg-[#eef1f6] hover:text-accent"
                        }
                      >
                        {r.unmapped ? "จับคู่สินค้า" : "⊕"}
                      </button>
                    </div>
                    <div className="mt-[2px] text-[11px] text-muted-2">
                      {ctx} · {r.detail}
                    </div>
                  </td>

                  {r.evalResult.cells.map((cell) => (
                    <td key={cell.key} className="border-t border-border-2 px-[11px] py-3 text-right">
                      <span
                        className="num text-[12px] font-semibold"
                        style={{ color: r.unmapped ? "#3a3f47" : cell.ok ? "#1f8a5b" : "#d6453d" }}
                      >
                        {cell.disp}
                      </span>
                    </td>
                  ))}

                  <td className="border-t border-border-2 px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onBudget(r.campaign.id)}
                      title="ปรับงบ"
                      className="num inline-flex items-center justify-end gap-[6px] rounded-[7px] border-none bg-transparent px-[6px] py-1 text-[13px] font-semibold text-ink hover:bg-[#eef1f6] hover:text-accent"
                    >
                      <span className="text-[11px] opacity-[0.55]">✎</span>
                      <span className="inline-flex flex-col items-end leading-[1.05]">
                        <span>{fmtMoney(r.budget)}</span>
                        {r.budgetChanged && (
                          <span className="text-[9px] font-bold uppercase tracking-[0.03em] text-warn">
                            แก้แล้ว
                          </span>
                        )}
                      </span>
                    </button>
                  </td>

                  <td className="border-t border-border-2 px-[14px] py-3">
                    <StatusChip color={r.state.statusColor}>
                      {r.state.statusLabel}
                    </StatusChip>
                  </td>

                  <td className="border-t border-border-2 px-[18px] py-3 text-right">
                    <div className="flex justify-end">
                      <Toggle
                        on={r.state.on}
                        onClick={() => onToggle(r.campaign.id, r.state.defaultOn)}
                        label={`เปิด/ปิด ${r.campaign.name}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({
  children,
  onClick,
  active,
  align = "right",
  pad = "px-[11px]",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  align?: "left" | "right";
  pad?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`${pad} cursor-pointer select-none py-[9px] font-semibold ${align === "left" ? "text-left" : "text-right"} ${active ? "text-accent" : "text-muted"}`}
    >
      {children}
    </th>
  );
}

function Arrow({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`text-[10px] ${on ? "text-accent" : "text-[#c2c7cf]"}`}>{children}</span>;
}
