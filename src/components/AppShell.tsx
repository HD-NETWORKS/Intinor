"use client";

import { useState } from "react";
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
  const [navOpen, setNavOpen] = useState(false);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <ModeBanner />
      <header className="flex flex-wrap items-center gap-3 border-b border-border-default bg-panel-strong px-4 py-3 sm:px-6">
        <Image src="/logo.png" alt="HD Networks" width={178} height={92} className="h-9 w-auto" priority />
        <span className="hidden text-sm text-muted sm:inline">Intinor Direkt dashboard</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <UnitSwitcher />
          <LogoutButton />
          <button
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={navOpen}
            className="rounded border border-border-strong p-1.5 text-muted hover:bg-panel-hover hover:text-body md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M2 4.5h14M2 9h14M2 13.5h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <Nav open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </>
  );
}
