import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/store/AppProvider";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { KpiSummaryStrip } from "@/components/shell/KpiSummaryStrip";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdsHub · Media Command Center",
  description: "Consolidated Meta/Facebook Ads management for performance marketing teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${plexThai.variable} ${plexMono.variable}`}>
      <body className="font-sans text-ink">
        <AppProvider>
          <ThemeSync />
          <div className="flex min-h-screen bg-page-bg">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <div className="flex flex-col gap-[18px] px-[26px] pb-10 pt-[22px]">
                <KpiSummaryStrip />
                {children}
              </div>
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
