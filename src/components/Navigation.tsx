"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const SEITEN = [
  { href: "/einzelfall", name: "Einzelfallprüfung" },
  { href: "/kontrolle", name: "Kontrollprüfung" },
  { href: "/journal", name: "Journalprüfung" },
];

export default function Navigation() {
  const pfad = usePathname();
  const router = useRouter();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4">
        <nav aria-label="Module" className="-mb-px flex flex-1 gap-1 overflow-x-auto">
          {SEITEN.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={pfad === s.href ? "page" : undefined}
              className={`flex min-h-12 shrink-0 touch-manipulation items-center border-b-2 px-4 text-sm font-medium ${
                pfad === s.href ? "border-slate-900 text-slate-900" : "border-transparent text-slate-600 active:bg-slate-50"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/");
            router.refresh();
          }}
          aria-label="Abmelden"
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
