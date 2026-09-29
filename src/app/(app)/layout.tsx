import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import { istAngemeldet } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Zweite Sperre neben dem Proxy (Defense in Depth).
  if (!(await istAngemeldet())) redirect("/");
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          Berechnungen laufen im Browser; eingefügte Daten werden nicht an einen Server gesendet. Ergebnisse sind Prüfhinweise und ersetzen nicht das Urteil des Prüfers.
        </p>
        {children}
      </main>
    </div>
  );
}
