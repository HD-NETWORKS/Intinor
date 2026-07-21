import type { Metadata } from "next";
import "./globals.css";
import { ModeBanner } from "@/components/ModeBanner";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "HD Networks — Intinor Dashboard",
  description:
    "Custom dashboard for the Intinor Direkt router basic mobile (D01393)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ModeBanner />
        <header className="border-b border-slate-800 bg-slate-950/60 px-6 py-3 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">
            HD Networks
          </h1>
          <span className="text-sm text-slate-400">
            Intinor Direkt dashboard
          </span>
        </header>
        <div className="flex flex-1">
          <Nav />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
