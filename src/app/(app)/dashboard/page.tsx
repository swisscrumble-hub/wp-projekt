import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MODULE } from "@/components/module";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Übersicht</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Wähle eine Prüfungshandlung. Grundlage ist das Schweizer Handbuch der Wirtschaftsprüfung, Band Ordentliche Revision (HWP OR 2024).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {MODULE.map(({ href, name, icon: Icon, text, schritte, norm }) => (
          <Link
            key={href}
            href={href}
            className="group flex touch-manipulation flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:translate-y-0"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
            <ol className="mt-auto flex flex-wrap gap-1.5" aria-label="Ablauf">
              {schritte.map((s) => (
                <li key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {s}
                </li>
              ))}
            </ol>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{norm}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
