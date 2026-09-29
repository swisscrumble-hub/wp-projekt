"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";

export default function LoginFormular() {
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const router = useRouter();

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwort }),
    });
    if (res.ok) {
      router.replace("/stichproben");
      router.refresh();
      return;
    }
    setFehler((await res.json().catch(() => null))?.error ?? "Anmeldung fehlgeschlagen.");
    setLaeuft(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={anmelden} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <Lock className="h-5 w-5" aria-hidden />
          <h1 className="text-lg font-semibold">Prüfungshandlungen</h1>
        </div>
        <p className="text-sm text-slate-600">Geschützter Bereich. Bitte melde dich an.</p>
        <label className="block text-sm font-medium text-slate-700">
          Passwort
          <input
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus:border-slate-900 focus:outline-none"
          />
        </label>
        {fehler && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {fehler}
          </p>
        )}
        <button type="submit" disabled={laeuft} className="min-h-11 w-full touch-manipulation rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">
          Anmelden
        </button>
      </form>
    </main>
  );
}
