"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons/Icon";
import { getNotifications, getRules } from "@/lib/api";
import { effRuleOn } from "@/lib/resolvers";
import type { Notification, NotificationKind, Rule } from "@/data/types";
import { useAppStore } from "@/store/AppProvider";

const KIND_META: Record<
  NotificationKind,
  { icon: IconName; text: string; chip: string; label: string }
> = {
  success: { icon: "check", text: "text-success", chip: "bg-success/[0.09]", label: "ทำงานสำเร็จ" },
  warn: { icon: "alert", text: "text-danger", chip: "bg-danger/[0.09]", label: "ต้องตรวจสอบ" },
  info: { icon: "info", text: "text-accent", chip: "bg-accent/[0.09]", label: "อัปเดต" },
};

export function NotificationsBell() {
  const router = useRouter();
  const open = useAppStore((s) => s.notifOpen);
  const read = useAppStore((s) => s.notifRead);
  const toggle = useAppStore((s) => s.toggleNotif);
  const close = useAppStore((s) => s.closeNotif);
  const ruleOverride = useAppStore((s) => s.ruleOverride);

  const [rules, setRules] = useState<Rule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  useEffect(() => {
    let alive = true;
    getRules().then((r) => alive && setRules(r));
    getNotifications().then((n) => alive && setNotifications(n));
    return () => {
      alive = false;
    };
  }, []);

  const unread = read ? 0 : notifications.length;
  const warnCount = notifications.filter((n) => n.kind === "warn").length;
  const activeRules = rules.filter((r) => effRuleOn(r, ruleOverride)).length;
  const offRules = rules.length - activeRules;
  const rulesOk = offRules === 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title="การแจ้งเตือน"
        aria-label="การแจ้งเตือน · Notifications"
        aria-expanded={open}
        className={`relative flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-control border border-[#dde1e7] transition-colors duration-bg ${
          open ? "bg-ink text-white" : "bg-card text-ink"
        }`}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span className="num absolute -right-[5px] -top-[5px] flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 border-page-bg bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="ปิด"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-[46px] z-50 w-[388px] overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-card shadow-dropdown">
            <div className="flex items-center justify-between border-b border-border-2 px-4 py-[13px]">
              <div className="text-[14px] font-semibold">การแจ้งเตือน · Notifications</div>
              <span className="num text-[11px] font-semibold text-danger">
                {warnCount} ต้องตรวจสอบ
              </span>
            </div>

            <div
              className="flex items-center gap-2 border-b border-border-2 px-4 py-[11px]"
              style={{ background: rulesOk ? "#f0f8f4" : "#fbf6ec" }}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: rulesOk ? "#1f8a5b" : "#c98a16" }}
              />
              <span
                className="num text-[12px] font-semibold"
                style={{ color: rulesOk ? "#1f8a5b" : "#9a6a12" }}
              >
                {rulesOk
                  ? `ระบบอัตโนมัติทำงานปกติ · ${activeRules} กฎ`
                  : `มี ${offRules} กฎถูกปิด · ทำงานอยู่ ${activeRules} กฎ`}
              </span>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {notifications.map((n) => {
                const m = KIND_META[n.kind];
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-[11px] border-b border-[#f3f4f6] px-4 py-3"
                  >
                    <div
                      className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-input ${m.chip} ${m.text}`}
                    >
                      <Icon name={m.icon} size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[7px]">
                        <span className="text-[12.5px] font-semibold text-ink">{n.title}</span>
                        <span className={`rounded-[5px] px-[7px] py-[2px] text-[10px] font-semibold ${m.chip} ${m.text}`}>
                          {m.label}
                        </span>
                      </div>
                      <div className="mt-[3px] text-[11.5px] leading-[1.4] text-muted">
                        {n.detail}
                      </div>
                    </div>
                    <span className="num flex-shrink-0 text-[10.5px] text-faint">{n.time}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                close();
                router.push("/activity");
              }}
              className="w-full border-t border-border-2 bg-field-bg p-[11px] text-[12.5px] font-semibold text-accent"
            >
              ดูประวัติการทำงานทั้งหมด →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
