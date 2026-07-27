"use client";

import { usePathname } from "next/navigation";
import { ModeBanner } from "./ModeBanner";
import { Nav } from "./Nav";
import { LogoutButton } from "./LogoutButton";

/** Hides the dashboard chrome (nav, header, mode banner) on the public login page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <ModeBanner />
      <header className="border-b border-slate-800 bg-slate-950/60 px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">HD Networks</h1>
        <span className="text-sm text-slate-400">Intinor Direkt dashboard</span>
        <LogoutButton />
      </header>
      <div className="flex flex-1">
        <Nav />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  );
}
