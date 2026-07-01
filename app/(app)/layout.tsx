import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { AppProvider } from "@/store/AppProvider";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { KpiSummaryStrip } from "@/components/shell/KpiSummaryStrip";

// Auth gate for the whole dashboard. getCurrentUser() is the real boundary
// (middleware only does a cheap cookie-presence check). Unauthenticated → /login.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppProvider>
      <ThemeSync />
      <div className="flex min-h-screen bg-page-bg">
        <Sidebar user={user} />
        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex flex-col gap-[18px] px-[26px] pb-10 pt-[22px]">
            <KpiSummaryStrip />
            {children}
          </div>
        </main>
      </div>
    </AppProvider>
  );
}
