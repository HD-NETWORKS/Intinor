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
      className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
    >
      Log out
    </button>
  );
}
