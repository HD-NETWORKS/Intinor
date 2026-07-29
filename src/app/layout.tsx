import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { UnitProvider } from "@/lib/units/context";

export const metadata: Metadata = {
  title: "HD Networks — Intinor Dashboard",
  description: "Custom dashboard for Intinor Direkt encoder units",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <UnitProvider>
          <AppShell>{children}</AppShell>
        </UnitProvider>
      </body>
    </html>
  );
}
