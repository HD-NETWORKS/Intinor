"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-panel-hover hover:text-body"
    >
      Log out
    </button>
  );
}
