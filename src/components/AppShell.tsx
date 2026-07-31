"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { ModeBanner } from "./ModeBanner";
import { Nav } from "./Nav";
import { LogoutButton } from "./LogoutButton";
import { UnitSwitcher } from "./UnitSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/** Hides the dashboard chrome (nav, header, mode banner) on the public login page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <ModeBanner />
      <header className="border-b border-border-default bg-panel-strong px-6 py-3 flex items-center gap-3">
        <Image src="/logo.png" alt="HD Networks" width={178} height={92} className="h-9 w-auto" priority />
        <span className="text-sm text-muted">Intinor Direkt dashboard</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UnitSwitcher />
          <LogoutButton />
        </div>
      </header>
      <div className="flex flex-1">
        <Nav />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  );
}
