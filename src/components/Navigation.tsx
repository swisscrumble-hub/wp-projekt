"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut } from "lucide-react";

export default function Navigation() {
  const pfad = usePathname();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-1.5">
        <Link
          href="/dashboard"
          aria-current={pfad === "/dashboard" ? "page" : undefined}
          className={`flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 text-sm font-medium ${
            pfad === "/dashboard" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100 active:bg-slate-100"
          }`}
        >
          <Home className="h-5 w-5" aria-hidden />
          Home
        </Link>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/");
            router.refresh();
          }}
          aria-label="Abmelden"
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-100"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
