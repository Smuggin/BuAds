"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-input border border-[#dde1e7] bg-card px-[10px] py-[9px] text-[13px] text-ink outline-none focus:border-accent";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "เข้าสู่ระบบไม่สำเร็จ · Sign in failed");
        setBusy(false);
        return;
      }
      router.push("/overview");
      router.refresh();
    } catch {
      setError("เครือข่ายขัดข้อง · Network error");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg px-6">
      <div className="w-[380px] max-w-full rounded-card border border-border bg-card shadow-card">
        {/* brand header */}
        <div className="flex items-center gap-[11px] border-b border-border-2 px-[22px] py-[18px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-input bg-accent text-[15px] font-bold text-white">
            A
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-ink">AdsHub</div>
            <div className="text-caption tracking-[0.04em] text-muted">
              MEDIA COMMAND CENTER
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-[16px] px-[22px] py-[22px]">
          <div>
            <div className="text-[16px] font-semibold text-ink">เข้าสู่ระบบ · Sign in</div>
            <div className="mt-[2px] text-[12.5px] text-muted">
              สำหรับทีมงานเท่านั้น · Team members only
            </div>
          </div>

          {error && (
            <div className="rounded-input border border-danger/30 bg-danger/[0.08] px-[11px] py-[9px] text-[12.5px] text-danger">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-[6px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">
              ชื่อผู้ใช้ · Username
            </span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-muted-2">
              รหัสผ่าน · Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-[2px] rounded-[10px] border-none bg-accent py-3 text-[13.5px] font-semibold text-white transition-opacity duration-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "กำลังเข้าสู่ระบบ… · Signing in…" : "เข้าสู่ระบบ · Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
