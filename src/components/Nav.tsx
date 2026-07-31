"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePolledResource } from "@/hooks/usePolledResource";
import type { VideoMixersList } from "@/lib/intinor/types";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/router", label: "Router panel" },
  { href: "/inputs", label: "Network inputs" },
  { href: "/netvideo", label: "Netvideo inputs" },
  { href: "/mixer", label: "Video mixer" },
  { href: "/encoders", label: "Encoders" },
  { href: "/encoding-modes", label: "Encoding modes" },
  { href: "/test-picture", label: "Test picture" },
  { href: "/users", label: "Local users" },
  { href: "/system", label: "System" },
];

export function Nav() {
  const pathname = usePathname();
  // Long poll interval: this only decides whether to show the "Video mixer"
  // link at all, so it doesn't need to track live changes. `data === null`
  // (not yet loaded) shows the link by default rather than flash-hiding it.
  const { data } = usePolledResource<VideoMixersList>("video_mixers", 30000);
  const hasMixers = data == null || data.video_mixers.length > 0;

  const items = ITEMS.filter((item) => item.href !== "/mixer" || hasMixers);

  return (
    <nav className="w-48 shrink-0 border-r border-border-default bg-panel-strong p-3">
      <ul className="space-y-1">
        {items.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={
                  "block rounded px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-sky-500/15 text-accent"
                    : "text-muted hover:bg-panel-hover hover:text-body")
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
