"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/inputs", label: "Network inputs" },
  { href: "/mixer", label: "Video mixer" },
  { href: "/encoders", label: "Encoders" },
  { href: "/system", label: "System" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 border-r border-slate-800 bg-slate-950/40 p-3">
      <ul className="space-y-1">
        {ITEMS.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={
                  "block rounded px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200")
                }
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
