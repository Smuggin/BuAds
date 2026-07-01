"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth/current";

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[236px] flex-shrink-0 flex-col bg-nav-bg text-nav-text">
      {/* brand */}
      <div className="flex items-center gap-[11px] border-b border-nav-line px-5 pb-[18px] pt-[22px]">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-input bg-accent text-[15px] font-bold text-white">
          A
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight text-white">AdsHub</div>
          <div className="text-caption tracking-[0.04em] text-nav-muted">
            MEDIA COMMAND CENTER
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-[3px] p-3">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.id}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex w-full items-center gap-[11px] rounded-control px-3 py-[9px] text-left transition-colors duration-bg ${
                active ? "bg-nav-active text-white" : "text-nav-text hover:bg-nav-active/50"
              }`}
            >
              <span
                className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
                style={{ background: active ? "var(--accent)" : "#4a4f59" }}
              />
              <span className="flex flex-col items-start leading-[1.15]">
                <span className="text-[13.5px] font-medium">{n.th}</span>
                <span
                  className={`text-caption tracking-[0.02em] ${
                    active ? "text-nav-en-active" : "text-nav-dim"
                  }`}
                >
                  {n.en}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* footer */}
      <div className="flex items-center gap-[10px] border-t border-nav-line px-[18px] py-[14px]">
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-medium text-white">{user.name}</div>
          <div className="truncate text-caption text-nav-muted">
            {user.username ?? user.email}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={signingOut}
          title="ออกจากระบบ · Sign out"
          aria-label="ออกจากระบบ · Sign out"
          className="flex-shrink-0 rounded-control p-[7px] text-nav-muted transition-colors duration-bg hover:bg-nav-active/50 hover:text-white disabled:opacity-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
