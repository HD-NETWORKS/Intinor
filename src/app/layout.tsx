import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { UnitProvider } from "@/lib/units/context";
import { SelectionProvider } from "@/lib/navigation/selection";
import { ThemeProvider } from "@/lib/theme/context";
import { THEME_STORAGE_KEY } from "@/lib/theme/constants";

export const metadata: Metadata = {
  title: "HD Networks — Intinor Dashboard",
  description: "Custom dashboard for Intinor Direkt encoder units",
};

/** Brand typography (see the HD Networks brand kit): Sora for headings, Inter for body, JetBrains Mono for technical/label accents. */
const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sora" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains-mono",
});

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${sora.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <UnitProvider>
            <SelectionProvider>
              <AppShell>{children}</AppShell>
            </SelectionProvider>
          </UnitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
