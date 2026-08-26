"use client";

import { useEffect, useRef } from "react";
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

/**
 * Static sidebar on desktop (md+). Below that it's an off-canvas drawer:
 * hidden by default, toggled by the hamburger button in AppShell's header,
 * and closes itself on navigation or backdrop click.
 *
 * `triggerRef` is the hamburger button — focus moves into the drawer's first
 * link when it opens, Tab is trapped inside while it's open, and Escape (or
 * any other close path) returns focus to the trigger, so keyboard users
 * aren't dropped into empty space or left with two focus rings on screen.
 */
export function Nav({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // Long poll interval: this only decides whether to show the "Video mixer"
  // link at all, so it doesn't need to track live changes. `data === null`
  // (not yet loaded) shows the link by default rather than flash-hiding it.
  const { data } = usePolledResource<VideoMixersList>("video_mixers", 30000);
  const hasMixers = data == null || data.video_mixers.length > 0;

  const items = ITEMS.filter((item) => item.href !== "/mixer" || hasMixers);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close on route change only
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = navRef.current?.querySelectorAll<HTMLElement>("a");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, triggerRef]);

  function closeAndReturnFocus() {
    onClose();
    triggerRef.current?.focus();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeAndReturnFocus}
          aria-hidden="true"
        />
      )}
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className={
          "fixed inset-y-0 right-0 z-50 w-48 shrink-0 overflow-y-auto border-l border-border-default " +
          "bg-panel-strong p-3 transition-transform duration-200 md:static md:z-auto md:translate-x-0 " +
          "md:border-l-0 md:border-r " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <ul className="space-y-1">
          {items.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    "block rounded border-l-2 px-3 py-2 text-sm transition-colors " +
                    (active
                      ? "border-brand-500 bg-brand-500/15 text-accent"
                      : "border-transparent text-muted hover:bg-panel-hover hover:text-body")
                  }
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
